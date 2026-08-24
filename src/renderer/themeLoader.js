import { setLedStatus } from './statusManager.js';
import { STORAGE_KEYS } from './constants.js';

let monaco = null;

// Use Vite's standard import.meta.glob with eager loading
const themeModules = import.meta.glob('./themes/*.json', { eager: true });

export const availableThemes = Object.keys(themeModules)
  .map(path => path.replace(/^\.\/themes\//, '').replace(/\.json$/i, ''))
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
  return themeSetting;
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
    k.replace(/^\.\/themes\//, '').replace(/\.json$/i, '') === actualName
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

  if (typeof document === 'undefined') return theme;
  const root = document.documentElement;

  // Map all theme colors to CSS custom properties (dash‑separated).
  if (theme.colors) {
    Object.entries(theme.colors).forEach(([key, value]) => {
      const cssVar = `--${key.replace(/\./g, '-')}`;
      root.style.setProperty(cssVar, value);
    });

    // Also update core app UI variables for consistent theme experience
    if (theme.colors['editor.background']) {
      root.style.setProperty('--bg-secondary', theme.colors['editor.background']);
      root.style.setProperty('--editor-bg', theme.colors['editor.background']);
    }
    if (theme.colors['sideBar.background']) {
      root.style.setProperty('--bg-primary', theme.colors['sideBar.background']);
      root.style.setProperty('--bg-card', theme.colors['sideBar.background']);
    }
    if (theme.colors['editor.foreground']) {
      root.style.setProperty('--text-main', theme.colors['editor.foreground']);
      root.style.setProperty('--editor-fg', theme.colors['editor.foreground']);
    }
    const rawHeaderColor = theme.colors['titleBar.activeBackground']
      || theme.colors['editor.background']
      || (theme.base === 'vs' ? '#f6f8fa' : '#171a1d');
    const headerBgColor = sanitizeHexColor(rawHeaderColor, theme.base === 'vs' ? '#f6f8fa' : '#171a1d');
    root.style.setProperty('--header-bg', headerBgColor);

    if (theme.colors['editorGroup.border']) {
      root.style.setProperty('--border-color', theme.colors['editorGroup.border']);
    }
    if (theme.colors['button.background']) {
      root.style.setProperty('--button-bg', theme.colors['button.background']);
    }
    if (theme.colors['button.foreground']) {
      root.style.setProperty('--button-fg', theme.colors['button.foreground']);
    }
    if (theme.colors['dropdown.background']) {
      root.style.setProperty('--dropdown-bg', theme.colors['dropdown.background']);
    }
  }

  // Light/Dark root class toggle
  if (theme.base === 'vs') {
    root.classList.add('light-theme');
  } else {
    root.classList.remove('light-theme');
  }

  // Register & apply theme to Monaco Editor if available
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

  // Update native OS window title bar overlay (low-overhead fire-and-forget with memoization)
  updateNativeTitleBarOverlay(theme);

  setLedStatus('thm', true, `4. Theme: ${actualThemeName} Applied`);

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

// Low-overhead memoized TitleBarOverlay updater
let lastTitleBarColor = null;
let lastSymbolColor = null;

function sanitizeHexColor(color, defaultHex) {
  if (!color || typeof color !== 'string') return defaultHex;
  const clean = color.trim();
  if (clean.startsWith('#')) {
    if (clean.length === 4) {
      return `#${clean[1]}${clean[1]}${clean[2]}${clean[2]}${clean[3]}${clean[3]}`;
    }
    if (clean.length >= 7) {
      return `#${clean.substring(1, 7)}`;
    }
  }
  return defaultHex;
}

function updateNativeTitleBarOverlay(theme) {
  if (!window.engineAPI?.setTitleBarOverlay) return;

  const defaultHex = theme.base === 'vs' ? '#f6f8fa' : '#171a1d';
  const rawHeaderColor = theme.colors?.['titleBar.activeBackground']
    || theme.colors?.['editor.background']
    || defaultHex;

  const headerColor = sanitizeHexColor(rawHeaderColor, defaultHex);
  const symbolColor = getContrastingSymbolColor(headerColor, theme.base === 'vs');

  // Skip IPC dispatch if color values haven't changed (memoization)
  if (headerColor === lastTitleBarColor && symbolColor === lastSymbolColor) {
    return;
  }

  lastTitleBarColor = headerColor;
  lastSymbolColor = symbolColor;

  // Non-blocking async dispatch
  window.engineAPI.setTitleBarOverlay({
    color: headerColor,
    symbolColor: symbolColor,
    height: 38
  }).catch(() => {});
}

function getContrastingSymbolColor(hexColor, isLightTheme) {
  if (!hexColor || typeof hexColor !== 'string') {
    return isLightTheme ? '#111111' : '#ffffff';
  }
  const cleanHex = hexColor.replace('#', '').trim();
  if (cleanHex.length >= 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#111111' : '#ffffff';
  }
  return isLightTheme ? '#111111' : '#ffffff';
}

