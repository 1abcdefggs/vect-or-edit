/**
 * Monaco option model: turns the generated catalog (monacoOptions.catalog.json) into flat controls,
 * decides which ones the app owns, and converts stored overrides into `updateOptions` payloads.
 * Pure functions only (no DOM, no Monaco), so the rules can be tested in isolation.
 */

/** Options the settings page already owns. The panel shows them read-only so two controls never fight over one value. */
export const MANAGED_BY_SETTINGS = new Set([
  'fontFamily',
  'fontSize',
  'lineHeight',
  'wordWrap',
  'lineNumbers',
  'renderLineHighlight',
  'renderWhitespace',
  'stickyScroll.enabled'
]);

/** Options the app depends on. Changing them would break the editor, so the panel shows them read-only. */
export const REQUIRED_BY_APP = new Set([
  'automaticLayout',
  'contextmenu',
  'fixedOverflowWidgets',
  'readOnly',
  'domReadOnly',
  'inDiffEditor',
  // The header theme selector owns the theme
  'theme'
]);

export const LOCK_SETTINGS = 'settings';
export const LOCK_APP = 'app';
export const LOCK_UNSUPPORTED = 'unsupported';

/** Group id for each option, first matching rule wins. Group labels live in the locale files (monaco_group_*). */
const GROUP_RULES = [
  ['accessibility', /^(accessibility|aria|screenReader|tabFocusMode|allowVariableFonts)/],
  ['find', /^(find|seedSearch|selectionHighlight|occurrencesHighlight|wordHighlight)/],
  ['suggest', /^(suggest|quickSuggestions|acceptSuggestion|snippetSuggestions|wordBasedSuggestions|tabCompletion|inlineSuggest|parameterHints|hover|lightbulb|codeAction|inlayHints|inlineCompletions|gotoLocation|definitionLinkOpensInPeek|peekWidget|links|colorDecorators|semanticHighlighting|smartSelect|quickSuggestionsDelay)/],
  ['cursor', /^(cursor|multiCursor|selectOnLineNumbers|roundedSelection|columnSelection|mouseWheel|mouseStyle|copyWithSyntaxHighlighting|emptySelectionClipboard|selectionClipboard|dragAndDrop|dropIntoEditor|pasteAs|wordSeparators|wordSegmenterLocales|stopRenderingLineAfter)/],
  ['editing', /^(autoClosing|autoIndent|autoSurround|formatOn|insertSpaces|tabSize|detectIndentation|trimAutoWhitespace|trimWhitespaceOnDelete|linkedEditing|renameOn|useTabStops|wordBreak|wrappingIndent|wrappingStrategy|unusualLineTerminators|stickyTabStops|largeFileOptimizations|comments|bracketPairColorization|matchBrackets|autoClosingComments|screenReaderAnnounceInline|copyWith|overtype|smartSelect|inlineEdit|unicodeHighlight)/],
  ['scroll', /^(scroll|smoothScrolling|fastScrollSensitivity|mouseWheelScroll|revealHorizontal|overviewRuler|hideCursorInOverviewRuler|padding|scrollBeyond)/],
  ['display', /^(minimap|rulers|guides|folding|glyphMargin|lineDecorations|lineNumbersMinChars|renderFinalNewline|renderControlCharacters|renderLineHighlight|renderWhitespace|renderValidationDecorations|showFoldingControls|showUnused|showDeprecated|foldingHighlight|foldingImportsByDefault|foldingMaximumRegions|foldingStrategy|unfoldOnClickAfterEndOfLine|letterSpacing|fontLigatures|fontVariations|fontWeight|disableMonospaceOptimizations|disableLayerHinting|roundedSelection|stickyScroll|bracketPairColorization|extraEditorClassName|placeholder|lineHeight|fontSize|fontFamily|wordWrap|lineNumbers|experimentalWhitespaceRendering|showDeprecated|hideUnchanged|accessibilityPageSize|allowVariableLineHeights|effectiveExperimentalEditContext|experimentalEditContextEnabled|experimental)/]
];

export const GROUP_ORDER = ['display', 'cursor', 'editing', 'suggest', 'find', 'scroll', 'accessibility', 'advanced'];

export function groupOf(name) {
  for (const [group, re] of GROUP_RULES) if (re.test(name)) return group;
  return 'advanced';
}

function choicesOf(def) {
  const choices = [];
  if (def.kinds.includes('boolean')) choices.push(true, false);
  for (const v of def.enumValues) choices.push(v);
  return choices;
}

/** Kind of control for one option or nested member: boolean | enum | number | text | json | unsupported. */
function controlKind(def) {
  const kinds = def.kinds || [];
  if (def.enumValues?.length) return 'enum';
  if (kinds.length === 1) {
    if (kinds[0] === 'boolean') return 'boolean';
    if (kinds[0] === 'number') return 'number';
    if (kinds[0] === 'string') return 'text';
    if (kinds[0] === 'function') return 'unsupported';
  }
  if (kinds.length === 2 && kinds.includes('string') && kinds.includes('other')) return 'text';
  return 'json';
}

function lockOf(path) {
  if (MANAGED_BY_SETTINGS.has(path)) return LOCK_SETTINGS;
  if (REQUIRED_BY_APP.has(path)) return LOCK_APP;
  return null;
}

function makeControl(path, def, topName) {
  const kind = controlKind(def);
  const choices = kind === 'enum' ? choicesOf(def) : [];
  let lock = lockOf(path);
  // A dot inside the option's own name (e.g. "semanticHighlighting.enabled") would be read as a nested path;
  // the members of readOnlyMessage describe a Markdown string, which one input cannot express
  if (!lock && (kind === 'unsupported' || topName.includes('.') || topName === 'readOnlyMessage')) lock = LOCK_UNSUPPORTED;
  return {
    path,
    name: topName,
    member: path.includes('.') ? path.slice(topName.length + 1) : null,
    group: groupOf(topName),
    kind,
    choices,
    type: def.type,
    doc: def.doc || '',
    defaultText: def.defaultText || null,
    lock,
    // Monaco ignores `updateOptions` for these; they take effect when the editor is created (the next start)
    createOnly: /cannot be updated using/i.test(def.doc || '')
  };
}

/**
 * Flattens the catalog into one control per settable value. An option that is an object becomes one control per member
 * ("minimap.enabled", "minimap.side", ...); members that are objects themselves stay a JSON control.
 */
export function buildControls(catalog) {
  const controls = [];
  for (const def of catalog.options) {
    const nested = def.nested?.[0]?.members;
    if (nested?.length) {
      for (const m of nested) controls.push(makeControl(`${def.name}.${m.name}`, m, def.name));
    } else {
      controls.push(makeControl(def.name, def, def.name));
    }
  }
  return controls;
}

/** Controls by path, for fast lookup. */
export function indexControls(controls) {
  return new Map(controls.map((c) => [c.path, c]));
}

function matchesKind(control, value) {
  switch (control.kind) {
    case 'boolean': return typeof value === 'boolean';
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    case 'text': return typeof value === 'string' || typeof value === 'number';
    case 'enum': return control.choices.some((c) => c === value);
    case 'json': return value !== undefined;
    default: return false;
  }
}

/** Parses the stored JSON and keeps only entries that name a settable control and fit its type. */
export function sanitizeOverrides(raw, controlIndex) {
  let parsed = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch { return {}; }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const clean = {};
  for (const [path, value] of Object.entries(parsed)) {
    const control = controlIndex.get(path);
    if (control && !control.lock && matchesKind(control, value)) clean[path] = value;
  }
  return clean;
}

/** {"minimap.enabled": true, "rulers": [80]} -> {minimap: {enabled: true}, rulers: [80]} for `editor.updateOptions`. */
export function toEditorOptions(overrides) {
  const out = {};
  for (const [path, value] of Object.entries(overrides)) {
    const [top, member] = path.split('.');
    if (member === undefined) out[top] = value;
    else {
      if (typeof out[top] !== 'object' || out[top] === null) out[top] = {};
      out[top][member] = value;
    }
  }
  return out;
}

/** Reads the value of one path out of a resolved options snapshot (`{minimap: {enabled: false}, ...}`). */
export function readPath(snapshot, path) {
  const [top, member] = path.split('.');
  const v = snapshot?.[top];
  if (member === undefined) return v;
  return v && typeof v === 'object' ? v[member] : undefined;
}

/**
 * The default Monaco documents for an option ("Defaults to true", "Defaults to 'right'"), as a value the control can show.
 * Undefined when the documentation says nothing usable, so the control shows an unknown state instead of a guess.
 */
export function defaultValueOf(control) {
  const text = (control.defaultText || '').trim();
  if (!text) return undefined;
  const bare = text.replace(/^[`'"]+|[`'"]+$/g, '');
  switch (control.kind) {
    case 'boolean':
      if (/^true\b/i.test(bare)) return true;
      if (/^false\b/i.test(bare)) return false;
      return undefined;
    case 'number': {
      const n = Number(bare.split(/\s+/)[0]);
      return Number.isFinite(n) ? n : undefined;
    }
    case 'enum':
      return control.choices.find((c) => String(c) === bare);
    case 'text':
      return bare;
    default:
      return undefined;
  }
}

/** Text shown for a value in the panel, and the value string used by a <select> option. */
export function encodeValue(value) {
  return JSON.stringify(value);
}

export function decodeValue(text) {
  return JSON.parse(text);
}

/** Parses what the user typed into a text/number/json control. Returns {ok, value}. */
export function parseTyped(control, text) {
  const s = String(text).trim();
  if (control.kind === 'number') {
    if (s === '') return { ok: false };
    const n = Number(s);
    return Number.isFinite(n) ? { ok: true, value: n } : { ok: false };
  }
  if (control.kind === 'text') return { ok: true, value: String(text) };
  if (control.kind === 'json') {
    try { return { ok: true, value: JSON.parse(s) }; } catch { return { ok: false }; }
  }
  return { ok: false };
}

/** Filters controls by a search text over name, path and the documentation. */
export function filterControls(controls, query, docText = (c) => c.doc) {
  const q = query.trim().toLowerCase();
  if (!q) return controls;
  return controls.filter((c) => c.path.toLowerCase().includes(q) || docText(c).toLowerCase().includes(q));
}

/** Controls grouped in display order: [{group, controls}] without empty groups. */
export function groupControls(controls) {
  const byGroup = new Map(GROUP_ORDER.map((g) => [g, []]));
  for (const c of controls) byGroup.get(c.group).push(c);
  return GROUP_ORDER.map((group) => ({ group, controls: byGroup.get(group) })).filter((g) => g.controls.length);
}
