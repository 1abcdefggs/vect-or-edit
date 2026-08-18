import { setLedStatus } from './statusManager.js';

let monaco = null;

// Use Vite's standard import.meta.glob with eager loading
const themeModules = import.meta.glob('./themes/*.json', { eager: true });

export const availableThemes = Object.keys(themeModules)
  .map(path => path.replace(/^\.\/themes\//, '').replace(/\.json$/i, ''))
  .sort();

export function getThemeData(themeName) {
  const matchingKey = Object.keys(themeModules).find(k =>
    k.replace(/^\.\/themes\//, '').replace(/\.json$/i, '') === themeName
  );
  if (!matchingKey) return null;
  const mod = themeModules[matchingKey];
  return mod.default ?? mod;
}

export async function loadTheme(themeName) {
  if (!themeName) return null;

  let theme = getThemeData(themeName);
  if (!theme) {
    console.error(`Theme "${themeName}" could not be found in loaded themes.`);
    return null;
  }

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
    if (theme.colors['titleBar.activeBackground']) {
      root.style.setProperty('--header-bg', theme.colors['titleBar.activeBackground']);
      root.style.setProperty('--accent-color', theme.colors['titleBar.activeBackground']);
    } else {
      root.style.removeProperty('--header-bg');
    }
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
      const monacoThemeId = themeName.replace(/[^a-zA-Z0-9_-]/g, '-');
      monaco.editor.defineTheme(monacoThemeId, theme);
      monaco.editor.setTheme(monacoThemeId);
    }
  } catch (err) {
    console.warn('Could not set Monaco theme:', err);
  }

  // Update native OS window title bar overlay (low-overhead fire-and-forget with memoization)
  updateNativeTitleBarOverlay(theme);

  setLedStatus('thm', true, `4. Theme: ${themeName} Applied`);

  return theme;
}

// Low-overhead memoized TitleBarOverlay updater
let lastTitleBarColor = null;
let lastSymbolColor = null;

function updateNativeTitleBarOverlay(theme) {
  if (!window.engineAPI?.setTitleBarOverlay) return;

  const headerColor = theme.colors?.['titleBar.activeBackground']
    || theme.colors?.['editor.background']
    || (theme.base === 'vs' ? '#ffffff' : '#1e293b');

  // Compute contrast symbol color based on header luminance
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
    height: 48
  }).catch(() => {
    // Graceful no-op on non-supported platforms
  });
}

function getContrastingSymbolColor(hexColor, isLightTheme) {
  if (!hexColor || typeof hexColor !== 'string') {
    return isLightTheme ? '#111111' : '#ffffff';
  }
  const cleanHex = hexColor.replace('#', '').trim();
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#111111' : '#ffffff';
  }
  if (cleanHex.length >= 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#111111' : '#ffffff';
  }
  return isLightTheme ? '#111111' : '#ffffff';
}

