import { setLedStatus } from '../../core/statusManager.js';
import { STORAGE_KEYS } from '../../core/constants.js';
import { applyThemeToDOM } from '../ui/themeRenderer.js';
import { updateNativeTitleBarOverlay } from '../io/nativeTitleBar.js';

let monaco = null;

// Use Vite's standard import.meta.glob with eager loading
const themeModules = import.meta.glob('../../themes/*.json', { eager: true });

/**
 * Theme files are Monaco themes ({ base, inherit, rules, colors }). A VS Code theme ({ type, colors, tokenColors })
 * is converted to that shape on load, so one can be dropped into the themes folder as is:
 * - type "light" / "hcLight" -> base "vs", any other type -> "vs-dark" (a Monaco theme keeps its own base)
 * - tokenColors -> rules, appended after any rules (a scope list or comma-separated scopes becomes one rule each)
 * Not handled: "include" (a theme extending another file) and comments in the JSON, which the build rejects.
 * TextMate scopes only approximate Monaco's token names, so syntax colors of a VS Code theme are close, not identical.
 */
export function normalizeTheme(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const base = raw.base || ((raw.type === 'light' || raw.type === 'hcLight') ? 'vs' : 'vs-dark');
  const rules = Array.isArray(raw.rules) ? [...raw.rules] : [];
  if (Array.isArray(raw.tokenColors)) {
    for (const entry of raw.tokenColors) {
      const settings = entry?.settings;
      if (!settings || (!settings.foreground && !settings.background && !settings.fontStyle)) continue;
      const scopes = Array.isArray(entry.scope) ? entry.scope : String(entry.scope ?? '').split(',');
      for (const scope of scopes.map(s => String(s).trim())) {
        const rule = { token: scope };
        if (settings.foreground) rule.foreground = String(settings.foreground).replace(/^#/, '');
        if (settings.background) rule.background = String(settings.background).replace(/^#/, '');
        if (settings.fontStyle) rule.fontStyle = settings.fontStyle;
        rules.push(rule);
      }
    }
  }
  return { ...raw, base, inherit: raw.inherit !== false, rules, colors: raw.colors || {} };
}

/**
 * A theme is a family with a light face, a dark face or both, the way an OS theme works with its light and dark mode.
 * The file name says which face a file is:
 * - "Name.light.json" / "Name.dark.json": that face of "Name"
 * - "Name.json": the face its own base says (a VS Code theme dropped in as is); it is the family's original face,
 *   which a setting stored before appearance modes existed implied as its mode
 * A family missing a face shows the face it has in either mode.
 */
const FACES = ['light', 'dark'];

function buildFamilies() {
  const families = new Map();
  for (const [path, mod] of Object.entries(themeModules)) {
    const file = path.replace(/^.*\/themes\//, '').replace(/\.json$/i, '');
    const match = file.match(/^(.+)\.(light|dark)$/i);
    const theme = normalizeTheme(mod.default ?? mod);
    const ownFace = theme.base === 'vs' ? 'light' : 'dark';
    const name = match ? match[1] : file;
    const face = match ? match[2].toLowerCase() : ownFace;
    if (match && face !== ownFace) console.warn(`Theme file "${file}" is named ${face} but its base is ${theme.base}.`);
    const family = families.get(name) || { name, faces: {}, original: null };
    family.faces[face] = theme;
    if (!match) family.original = face;
    families.set(name, family);
  }
  return families;
}

const families = buildFamilies();

export const availableThemes = [...families.keys()].sort();

export const DEFAULT_THEME = families.has('GitHub') ? 'GitHub' : (availableThemes[0] || 'GitHub');

/** Whether a theme has both a light and a dark face (one with a single face looks the same in both modes). */
export function hasBothFaces(name) {
  const family = families.get(name);
  return !!family && FACES.every(face => family.faces[face]);
}

/**
 * Reads a stored or typed theme name. Accepts a family name in any case, and a face name from before families
 * ("GitHub Dark", "github-light"), which also says which face it meant.
 */
function parseThemeName(value) {
  if (!value || typeof value !== 'string') return null;
  const find = (s) => availableThemes.find(t => t.toLowerCase() === s.toLowerCase().replace(/[-_]/g, ' ').trim()
    || t.toLowerCase() === s.toLowerCase().trim());
  const direct = find(value);
  if (direct) return { name: direct, face: null };
  const faceMatch = value.match(/^(.+?)[\s_-]+(light|dark)$/i);
  const named = faceMatch && find(faceMatch[1]);
  return named ? { name: named, face: faceMatch[2].toLowerCase() } : null;
}

const readStoredTheme = () => localStorage.getItem(STORAGE_KEYS.THEME) || localStorage.getItem(STORAGE_KEYS.LEGACY_THEME);

/** Stored theme family. The only place that reads the theme storage keys; anything unknown (or the old "auto") is the default. */
export function getStoredThemeSetting() {
  return parseThemeName(readStoredTheme())?.name || DEFAULT_THEME;
}

export const COLOR_MODES = ['system', 'light', 'dark'];

export function isSystemDarkMode() {
  return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Appearance mode: 'system' follows the OS, 'light' / 'dark' pin it. Independent of the theme, it decides which face
 * of the theme shows. Before a mode was stored, a pinned theme implied its own mode and the old "auto" meant 'system'.
 */
export function getColorMode() {
  const stored = localStorage.getItem(STORAGE_KEYS.COLOR_MODE);
  if (COLOR_MODES.includes(stored)) return stored;
  const legacy = parseThemeName(readStoredTheme());
  if (!legacy) return 'system';
  return legacy.face || families.get(legacy.name)?.original || 'system';
}

/** Whether the mode currently resolves to dark (the OS decides only in 'system'). */
export function isDarkModeActive() {
  const mode = getColorMode();
  return mode === 'system' ? isSystemDarkMode() : mode === 'dark';
}

/**
 * The face of a theme to show: the asked one (else the current mode's), or the other face when the theme lacks it.
 * @param {string} themeSetting
 * @param {'light' | 'dark' | null} [face]
 */
function resolveFace(themeSetting, face = null) {
  const name = parseThemeName(themeSetting)?.name || DEFAULT_THEME;
  const family = families.get(name);
  if (!family) return null;
  const wanted = face || (isDarkModeActive() ? 'dark' : 'light');
  const shown = family.faces[wanted] ? wanted : FACES.find(f => family.faces[f]);
  const label = hasBothFaces(name) ? `${name} ${shown === 'light' ? 'Light' : 'Dark'}` : name;
  return { name, face: shown, label, theme: family.faces[shown] };
}

/**
 * Display name of the face that shows, e.g. "Dracula Light"; a theme with one face keeps its own name.
 * @param {string} themeSetting
 * @param {'light' | 'dark' | null} [face]
 */
export function getResolvedThemeName(themeSetting, face = null) {
  return resolveFace(themeSetting, face)?.label || themeSetting;
}

/**
 * Monaco theme id of the face that shows.
 * @param {string} themeSetting
 * @param {'light' | 'dark' | null} [face]
 */
export function getMonacoThemeId(themeSetting, face = null) {
  return getResolvedThemeName(themeSetting, face).replace(/[^a-zA-Z0-9_-]/g, '-');
}

/**
 * @param {string} themeSetting
 * @param {'light' | 'dark' | null} [face]
 */
export function getThemeData(themeSetting, face = null) {
  return resolveFace(themeSetting, face)?.theme || null;
}

// Global OS Dark/Light Mode Listener
if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getColorMode() === 'system') loadTheme(getStoredThemeSetting());
  });
}

/**
 * The five colors a theme card needs to draw a small editor sample: background, line numbers,
 * keyword, string and plain text. Read from the theme file, so a theme added to the themes folder shows up as is.
 * @param {string} themeSetting
 * @param {'light' | 'dark' | null} [face]
 */
export function getThemePreview(themeSetting, face = null) {
  const data = getThemeData(themeSetting, face);
  const colors = data?.colors || {};
  const rules = data?.rules || [];
  const fromRule = (name) => {
    const rule = rules.find((r) => r.foreground && String(r.token || '').split(' ').some((t) => t === name || t.startsWith(`${name}.`)));
    return rule ? `#${String(rule.foreground).replace(/^#/, '')}` : null;
  };
  const foreground = colors['editor.foreground'] || '#d4d4d4';
  return {
    background: colors['editor.background'] || '#1e1e1e',
    lineNumber: colors['editorLineNumber.foreground'] || foreground,
    keyword: fromRule('keyword') || foreground,
    string: fromRule('string') || fromRule('comment') || foreground,
    foreground
  };
}

const registeredMonacoThemes = new Set(['vs', 'vs-dark', 'hc-black', 'hc-light']);

export function safeSetMonacoTheme(themeName, fallbackBase = 'vs-dark') {
  if (!monaco || !monaco.editor) return;
  const targetTheme = registeredMonacoThemes.has(themeName) ? themeName : (registeredMonacoThemes.has(fallbackBase) ? fallbackBase : 'vs-dark');
  try {
    monaco.editor.setTheme(targetTheme);
  } catch (err) {
    try {
      monaco.editor.setTheme(fallbackBase === 'vs' ? 'vs' : 'vs-dark');
    } catch (_) {}
  }
}

let lastThemeLabel = '';
let latestLoadId = 0;

/** Applies the face of a theme that the current appearance mode shows. */
export async function loadTheme(themeName) {
  const resolved = resolveFace(themeName);
  if (!resolved) {
    console.error(`Theme "${themeName}" could not be found in loaded themes.`);
    return null;
  }
  const { theme, label } = resolved;

  // 1. Apply to DOM CSS variables
  applyThemeToDOM(theme);

  // 1b. Native window-controls strip: it only needs the header color just applied, so it must not wait for Monaco
  // (at startup that import takes long enough to leave the controls in the splash color next to a finished UI)
  updateNativeTitleBarOverlay(theme);

  // Loads overlap (OS change, a picker, tone changes) and Monaco loads asynchronously: only the newest load may finish.
  const loadId = ++latestLoadId;

  // 2. Register & apply theme to Monaco Editor if available
  try {
    if (!monaco) {
      monaco = await import('monaco-editor');
    }
    if (monaco && monaco.editor) {
      await registerAllMonacoThemes();
      if (loadId !== latestLoadId) return theme;
      safeSetMonacoTheme(label.replace(/[^a-zA-Z0-9_-]/g, '-'), theme.base === 'vs' ? 'vs' : 'vs-dark');
    }
  } catch (err) {
    console.warn('Could not set Monaco theme:', err);
  }

  if (loadId !== latestLoadId) return theme;

  // Log only when the applied theme changes; repeated loads of the same theme would duplicate the pipeline line.
  const themeLabel = `2. THEME: ${label} Applied`;
  if (themeLabel !== lastThemeLabel) {
    lastThemeLabel = themeLabel;
    setLedStatus('thm', true, themeLabel);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app:themeApplied', { detail: { theme: label } }));
  }
  return theme;
}

/** Registers every face of every theme with Monaco under its face id ("Dracula-Light", "Monokai-Dark", "Tukune"...). */
export async function registerAllMonacoThemes() {
  try {
    if (!monaco) monaco = await import('monaco-editor');
    if (!monaco || !monaco.editor) return;

    for (const name of availableThemes) {
      for (const face of FACES) {
        if (!families.get(name).faces[face]) continue;
        const data = getThemeData(name, face);
        const id = getMonacoThemeId(name, face);
        if (registeredMonacoThemes.has(id)) continue;
        try {
          monaco.editor.defineTheme(id, {
            base: data.base === 'vs' ? 'vs' : 'vs-dark',
            inherit: data.inherit !== false,
            rules: Array.isArray(data.rules) ? data.rules : [],
            colors: data.colors || {}
          });
          registeredMonacoThemes.add(id);
        } catch (_) {}
      }
    }
  } catch (e) {
    console.warn('Failed to pre-register Monaco themes:', e);
  }
}
