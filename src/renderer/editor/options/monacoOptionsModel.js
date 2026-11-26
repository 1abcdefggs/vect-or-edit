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

/**
 * Options whose own name contains a dot. Monaco reads them as one flat key, so they are not split into a nested path
 * ({'semanticHighlighting.enabled': true}, never {semanticHighlighting: {enabled: true}}).
 */
const FLAT_DOTTED_NAMES = new Set(['semanticHighlighting.enabled']);

/** [top, member] of a control path; a flat dotted option name stays whole with no member. */
function splitPath(path) {
  return FLAT_DOTTED_NAMES.has(path) ? [path, undefined] : path.split('.');
}

export const LOCK_SETTINGS = 'settings';
export const LOCK_APP = 'app';
export const LOCK_UNSUPPORTED = 'unsupported';

/**
 * Group id for each option, first matching rule wins. Group labels live in the locale files (monaco_group_*).
 *
 * Basis of the groups: Monaco itself defines no groups (the catalog, monacoOptions.catalog.json, is generated from the
 * IEditorOptions and IGlobalEditorOptions type definitions and has only name, type, doc and source). These eight groups
 * are this app's own arrangement, made by the name prefix of each option, close to what a writer looks for
 * (display, cursor, editing, suggestions, find, scroll, accessibility). They do not copy the VS Code settings screen.
 * An option no rule matches goes to "advanced" (the label "Other"), so a new Monaco option is never lost.
 * Count by top-level option (Monaco 0.56.0, 180 options, checked 2026-11-18): display 43, cursor 26, editing 31,
 * suggest 29, find 6, scroll 12, accessibility 8, advanced 25. Candidates for a closer group, not moved:
 * codeLens* (suggest), inertialScroll and mouseMiddleClickAction (scroll or cursor), wrapOnEscapedLineFeeds (editing).
 */
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

/**
 * Sub-headings inside each group, in display order. The headings, the weight and the sub-heading of every option come from
 * monacoOptions.layout.json, generated from the editor options review sheet (monacoOptions.review.csv, in the repository).
 * An option the layout does not list (a new Monaco option) keeps the old name-prefix group below and has no sub-heading.
 * Weight 0 means no writer needs to judge the option; the panel folds those rows away and the search still finds them.
 */
export const SUB_ORDER = {
  display: ['font', 'linenumbers', 'wrap', 'folding', 'whitespace', 'currentline', 'minimap', 'guides', 'sticky', 'marks', 'rendering'],
  cursor: ['cursorshape', 'selection', 'multicursor', 'mouse'],
  editing: ['input', 'indent'],
  suggest: ['list', 'hover', 'goto'],
  find: ['find'],
  scroll: ['scrollbar', 'overview'],
  accessibility: ['assist'],
  advanced: []
};

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

/** Group, sub-heading and weight of one option: from the layout when it lists the path, else the name-prefix group. */
function placement(path, topName, layout) {
  const hit = layout?.items?.[path];
  if (hit && SUB_ORDER[hit[0]]?.includes(hit[1])) return { group: hit[0], sub: hit[1], weight: hit[2] };
  return { group: groupOf(topName), sub: null, weight: null };
}

function makeControl(path, def, topName, layout) {
  const kind = controlKind(def);
  const choices = kind === 'enum' ? choicesOf(def) : [];
  let lock = lockOf(path);
  // The members of readOnlyMessage describe a Markdown string, which one input cannot express.
  // A dotted option name that is not a known flat one would be read as a nested path, so it stays locked
  if (!lock && (kind === 'unsupported' || (topName.includes('.') && !FLAT_DOTTED_NAMES.has(topName)) || topName === 'readOnlyMessage')) lock = LOCK_UNSUPPORTED;
  return {
    path,
    name: topName,
    member: path === topName ? null : path.slice(topName.length + 1),
    ...placement(path, topName, layout),
    kind,
    choices,
    type: def.type,
    kinds: def.kinds || [],
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
export function buildControls(catalog, layout = null) {
  const controls = [];
  for (const def of catalog.options) {
    const nested = def.nested?.[0]?.members;
    if (nested?.length) {
      for (const m of nested) controls.push(makeControl(`${def.name}.${m.name}`, m, def.name, layout));
    } else {
      controls.push(makeControl(def.name, def, def.name, layout));
    }
  }
  return controls;
}

/** Controls by path, for fast lookup. */
export function indexControls(controls) {
  return new Map(controls.map((c) => [c.path, c]));
}

/** Value checks per Monaco kind; a json control accepts a value that fits one of the kinds its option declares. */
const JSON_KIND_CHECKS = {
  array: Array.isArray,
  object: (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
  string: (v) => typeof v === 'string',
  number: (v) => typeof v === 'number' && Number.isFinite(v),
  boolean: (v) => typeof v === 'boolean'
};

function fitsJson(control, value) {
  if (value === undefined) return false;
  const checks = (control.kinds || []).map((k) => JSON_KIND_CHECKS[k]).filter(Boolean);
  return checks.length === 0 || checks.some((check) => check(value));
}

function matchesKind(control, value) {
  switch (control.kind) {
    case 'boolean': return typeof value === 'boolean';
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    case 'text': return typeof value === 'string' || typeof value === 'number';
    case 'enum': return control.choices.some((c) => c === value);
    case 'json': return fitsJson(control, value);
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
    const [top, member] = splitPath(path);
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
  const [top, member] = splitPath(path);
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
    let value;
    try { value = JSON.parse(s); } catch { return { ok: false }; }
    return fitsJson(control, value) ? { ok: true, value } : { ok: false };
  }
  return { ok: false };
}

/** Filters controls by a search text over name, path and the documentation. */
export function filterControls(controls, query, docText = (c) => c.doc) {
  const q = query.trim().toLowerCase();
  if (!q) return controls;
  return controls.filter((c) => c.path.toLowerCase().includes(q) || docText(c).toLowerCase().includes(q));
}

/**
 * Controls grouped in display order, without empty groups: [{group, controls, subs}].
 * "subs" splits the group by sub-heading in SUB_ORDER order: [{sub, controls, main, rare}], where "main" holds the options a
 * writer may judge (weight above 0, highest weight first, sheet order within a weight) and "rare" the weight-0 ones.
 * Options without a sub-heading (not in the layout) form one entry with sub null.
 */
export function groupControls(controls) {
  const byGroup = new Map(GROUP_ORDER.map((g) => [g, []]));
  for (const c of controls) byGroup.get(c.group).push(c);
  return GROUP_ORDER.map((group) => ({ group, controls: byGroup.get(group), subs: splitSubs(group, byGroup.get(group)) })).filter((g) => g.controls.length);
}

function splitSubs(group, list) {
  const bySub = new Map();
  for (const c of list) {
    const key = c.sub ?? null;
    if (!bySub.has(key)) bySub.set(key, []);
    bySub.get(key).push(c);
  }
  const order = [...(SUB_ORDER[group] || []), null];
  return order.filter((sub) => bySub.has(sub)).map((sub) => {
    const all = bySub.get(sub);
    const rare = all.filter((c) => c.weight === 0);
    const main = all.filter((c) => c.weight !== 0).sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1));
    return { sub, controls: all, main, rare };
  });
}
