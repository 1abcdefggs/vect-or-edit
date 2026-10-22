/**
 * Monaco option overrides: the user's changes from the Editor Options panel, kept as one JSON object
 * ({"minimap.enabled": true}) under STORAGE_KEYS.MONACO_OPTIONS. Dual-Sync mirrors that key into .settings.json
 * like every other localStorage setting. The catalog is loaded on demand, so a user without overrides pays nothing.
 */
import { STORAGE_KEYS } from '../../core/constants.js';
import { syncSettingsToBackend } from '../../ui/settings/settingsState.js';
import { buildControls, indexControls, sanitizeOverrides, toEditorOptions, readPath } from './monacoOptionsModel.js';

let catalogPromise = null;
let controlsPromise = null;
let baseline = null;

/** The generated catalog (monacoOptions.catalog.json) plus the Japanese texts, loaded once. */
export function loadCatalog() {
  catalogPromise ||= Promise.all([
    import('./monacoOptions.catalog.json'),
    import('./monacoOptions.ja.json')
  ]).then(([catalog, ja]) => ({ catalog: catalog.default ?? catalog, ja: ja.default ?? ja }));
  return catalogPromise;
}

/** Flat controls and their index by path. */
export function loadControls() {
  controlsPromise ||= loadCatalog().then(({ catalog }) => {
    const controls = buildControls(catalog);
    return { controls, index: indexControls(controls) };
  });
  return controlsPromise;
}

function clone(value) {
  try { return JSON.parse(JSON.stringify(value)); } catch { return undefined; }
}

/**
 * The options the editor was given, in the form they were written ({minimap: {enabled: false}, wordWrap: 'on'}).
 * `getOption` would return Monaco's internal values (numbers for 'block', objects for lineNumbers), which no control can show
 * and `updateOptions` would not accept back. An option nobody set is absent here and falls back to Monaco's default.
 */
export function snapshotOptions(editor) {
  const raw = typeof editor?.getRawOptions === 'function' ? editor.getRawOptions() : null;
  return (raw && clone(raw)) || {};
}

/** Remembers what the app itself chose before any override, so a reset returns to that. */
export function captureBaseline(editor) {
  baseline = snapshotOptions(editor);
  return baseline;
}

export function getBaseline() {
  return baseline;
}

function readStored() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.MONACO_OPTIONS) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeStored(overrides) {
  try {
    if (Object.keys(overrides).length) localStorage.setItem(STORAGE_KEYS.MONACO_OPTIONS, JSON.stringify(overrides));
    else localStorage.removeItem(STORAGE_KEYS.MONACO_OPTIONS);
  } catch { /* storage unavailable */ }
  syncSettingsToBackend();
}

/** Stored overrides that still name a settable control (an option dropped by a Monaco update falls away). */
export async function getOverrides() {
  const { index } = await loadControls();
  return sanitizeOverrides(readStored(), index);
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Adds the overrides that Monaco only reads at creation (scrollbar arrows, shadows, slider sizes) to the options
 * the editor is created with. Members merge into the app's own object option instead of replacing it.
 */
export async function withCreateOnlyOverrides(base) {
  if (!localStorage.getItem(STORAGE_KEYS.MONACO_OPTIONS)) return base;
  try {
    const { index } = await loadControls();
    const own = {};
    for (const [path, value] of Object.entries(sanitizeOverrides(readStored(), index))) {
      if (index.get(path)?.createOnly) own[path] = value;
    }
    if (!Object.keys(own).length) return base;
    const merged = { ...base };
    for (const [top, value] of Object.entries(toEditorOptions(own))) {
      merged[top] = isPlainObject(base[top]) && isPlainObject(value) ? { ...base[top], ...value } : value;
    }
    return merged;
  } catch (err) {
    console.warn('[MonacoOptions] Could not read the creation-time options:', err);
    return base;
  }
}

/** Applies the stored overrides to a freshly created editor (the creation-time ones were passed to `create`). */
export async function applyStoredOverrides(editor) {
  if (!editor || !localStorage.getItem(STORAGE_KEYS.MONACO_OPTIONS)) return;
  const { index } = await loadControls();
  const live = {};
  for (const [path, value] of Object.entries(await getOverrides())) {
    if (!index.get(path)?.createOnly) live[path] = value;
  }
  if (Object.keys(live).length) editor.updateOptions(toEditorOptions(live));
}

/** Sets one override: stores it and, unless `live` is false (a creation-time option), shows it in the editor at once. */
export function setOverride(editor, path, value, { live = true } = {}) {
  const overrides = readStored();
  overrides[path] = value;
  writeStored(overrides);
  if (live) editor?.updateOptions(toEditorOptions({ [path]: value }));
}

/**
 * Removes one override and puts the editor back to what the app chose. An option the app never set is passed as
 * undefined, which Monaco reads as "use your default".
 */
export function resetOverride(editor, path, { live = true } = {}) {
  const overrides = readStored();
  delete overrides[path];
  writeStored(overrides);
  if (live && editor) editor.updateOptions(toEditorOptions({ [path]: readPath(baseline, path) }));
}

/** Removes every override. Creation-time options return to their default at the next start. */
export async function resetAllOverrides(editor) {
  const paths = Object.keys(readStored());
  writeStored({});
  if (!editor || !baseline) return paths;
  const { index } = await loadControls();
  const restore = {};
  for (const path of paths) {
    if (!index.get(path)?.createOnly) restore[path] = readPath(baseline, path);
  }
  if (Object.keys(restore).length) editor.updateOptions(toEditorOptions(restore));
  return paths;
}
