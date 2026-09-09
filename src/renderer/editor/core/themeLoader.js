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

export function getResolvedThemeName(themeSetting) {
  if (!themeSetting || themeSetting === 'auto' || themeSetting === 'System (Auto)') {
    const isDark = isSystemDarkMode();
    const target = isDark ? 'GitHub Dark' : 'GitHub Light';
    return availableThemes.includes(target) ? target : (availableThemes[0] || 'GitHub Dark');
  }
  // Allow matching "GitHub-Dark" or "github-dark" to "GitHub Dark"
  const normalizedInput = themeSetting.toLowerCase().replace(/[-_]/g, ' ');
  const match = availableThemes.find(t => t.toLowerCase() === normalizedInput || t.toLowerCase() === themeSetting.toLowerCase());
  return match || themeSetting;
}

// Global OS Dark/Light Mode Listener
if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const current = localStorage.getItem(STORAGE_KEYS.THEME) || 'auto';
    if (current === 'auto' || current === 'System (Auto)') {
      loadTheme('auto');
    }
  });
}

export function getThemeData(themeName) {
  const actualName = getResolvedThemeName(themeName);
  const matchingKey = Object.keys(themeModules).find(k =>
    k.replace(/^.*\/themes\//, '').replace(/\.json$/i, '') === actualName
  );
  if (!matchingKey) return null;
  const mod = themeModules[matchingKey];
  return mod.default ?? mod;
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

  // 2. Register & apply theme to Monaco Editor if available
  try {
    if (!monaco) {
      monaco = await import('monaco-editor');
    }
    if (monaco && monaco.editor) {
      await registerAllMonacoThemes();
      const monacoThemeId = actualThemeName.replace(/[^a-zA-Z0-9_-]/g, '-');
      const fallbackBase = theme.base === 'vs' ? 'vs' : 'vs-dark';
      safeSetMonacoTheme(monacoThemeId, fallbackBase);
    }
  } catch (err) {
    console.warn('Could not set Monaco theme:', err);
  }

  // 3. Update native OS window title bar overlay
  updateNativeTitleBarOverlay(theme);

  setLedStatus('thm', true, `2. THEME: ${actualThemeName} Applied`);

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
