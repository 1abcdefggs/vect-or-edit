import { setLedStatus } from '../../core/statusManager.js';
import { STORAGE_KEYS } from '../../core/constants.js';
import { applyThemeToDOM } from '../ui/themeRenderer.js';
import { updateNativeTitleBarOverlay } from '../io/nativeTitleBar.js';

let monaco = null;

// Use Vite's standard import.meta.glob with eager loading
const themeModules = import.meta.glob('../../themes/*.json', { eager: true });

export const availableThemes = Object.keys(themeModules)
  .map(path => path.replace(/^.*\/themes\//, '').replace(/\.json$/i, ''))
  .sort();

export function isSystemDarkMode() {
  return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

const isAutoSetting = (value) => !value || value === 'auto' || value === 'System (Auto)';

/** Stored theme setting ('auto' or a known theme name). The only place that reads the theme storage keys. */
export function getStoredThemeSetting() {
  const stored = localStorage.getItem(STORAGE_KEYS.LEGACY_THEME) || localStorage.getItem(STORAGE_KEYS.THEME);
  return (!isAutoSetting(stored) && availableThemes.includes(stored)) ? stored : 'auto';
}

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

const normalizedThemes = new WeakMap();

function themeObject(name) {
  const key = Object.keys(themeModules).find(k => k.replace(/^.*\/themes\//, '').replace(/\.json$/i, '') === name);
  if (!key) return null;
  const mod = themeModules[key];
  const raw = mod.default ?? mod;
  if (!normalizedThemes.has(raw)) normalizedThemes.set(raw, normalizeTheme(raw));
  return normalizedThemes.get(raw);
}

const isLightBase = (name) => themeObject(name)?.base === 'vs';

/**
 * The themes "Auto" switches between: the stored dark and light picks, each kept only while it really is a dark or
 * light theme, otherwise the GitHub pair.
 */
export function getAutoThemePair() {
  const pick = (storageKey, wantLight, fallback) => {
    const stored = localStorage.getItem(storageKey);
    if (stored && availableThemes.includes(stored) && isLightBase(stored) === wantLight) return stored;
    return availableThemes.includes(fallback) ? fallback : (availableThemes.find(t => isLightBase(t) === wantLight) || availableThemes[0] || fallback);
  };
  return {
    dark: pick(STORAGE_KEYS.THEME_DARK, false, 'GitHub Dark'),
    light: pick(STORAGE_KEYS.THEME_LIGHT, true, 'GitHub Light')
  };
}

export function isLightTheme(name) {
  return isLightBase(name);
}

export function getResolvedThemeName(themeSetting) {
  if (isAutoSetting(themeSetting)) {
    const pair = getAutoThemePair();
    return isSystemDarkMode() ? pair.dark : pair.light;
  }
  // Allow matching "GitHub-Dark" or "github-dark" to "GitHub Dark"
  const normalizedInput = themeSetting.toLowerCase().replace(/[-_]/g, ' ');
  const match = availableThemes.find(t => t.toLowerCase() === normalizedInput || t.toLowerCase() === themeSetting.toLowerCase());
  return match || themeSetting;
}

// Global OS Dark/Light Mode Listener
if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getStoredThemeSetting() === 'auto') loadTheme('auto');
  });
}

export function getThemeData(themeName) {
  return themeObject(getResolvedThemeName(themeName));
}

/**
 * The five colors a theme card needs to draw a small editor sample: background, line numbers,
 * keyword, string and plain text. Read from the theme file, so a theme added to the themes folder shows up as is.
 */
export function getThemePreview(themeSetting) {
  const data = getThemeData(themeSetting);
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

export async function loadTheme(themeName) {
  if (!themeName) return null;

  const actualThemeName = getResolvedThemeName(themeName);
  let theme = getThemeData(actualThemeName);
  if (!theme) {
    console.error(`Theme "${actualThemeName}" (setting: "${themeName}") could not be found in loaded themes.`);
    return null;
  }

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
      const monacoThemeId = actualThemeName.replace(/[^a-zA-Z0-9_-]/g, '-');
      const fallbackBase = theme.base === 'vs' ? 'vs' : 'vs-dark';
      safeSetMonacoTheme(monacoThemeId, fallbackBase);
    }
  } catch (err) {
    console.warn('Could not set Monaco theme:', err);
  }

  if (loadId !== latestLoadId) return theme;

  // Log only when the applied theme changes; repeated loads of the same theme would duplicate the pipeline line.
  const themeLabel = `2. THEME: ${actualThemeName} Applied`;
  if (themeLabel !== lastThemeLabel) {
    lastThemeLabel = themeLabel;
    setLedStatus('thm', true, themeLabel);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app:themeApplied', { detail: { theme: actualThemeName } }));
  }
  return theme;
}

export async function registerAllMonacoThemes() {
  try {
    if (!monaco) monaco = await import('monaco-editor');
    if (!monaco || !monaco.editor) return;

    for (const name of availableThemes) {
      const data = getThemeData(name);
      if (!data) continue;
      const safeTheme = {
        base: data.base === 'vs' ? 'vs' : 'vs-dark',
        inherit: data.inherit !== false,
        rules: Array.isArray(data.rules) ? data.rules : [],
        colors: data.colors || {}
      };
      const slug = name.replace(/[^a-zA-Z0-9_-]/g, '-');
      try {
        monaco.editor.defineTheme(slug, safeTheme);
        registeredMonacoThemes.add(slug);
      } catch (_) {}
      try {
        monaco.editor.defineTheme(name, safeTheme);
        registeredMonacoThemes.add(name);
      } catch (_) {}
    }
  } catch (e) {
    console.warn('Failed to pre-register Monaco themes:', e);
  }
}
