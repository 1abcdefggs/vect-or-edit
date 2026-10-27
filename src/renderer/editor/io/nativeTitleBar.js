/**
 * Low-overhead memoized Native TitleBarOverlay updater (Electron API integration)
 */
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

export function updateNativeTitleBarOverlay(theme) {
  if (!window.engineAPI?.setTitleBarOverlay || !theme) return;

  const defaultHex = theme.base === 'vs' ? '#f6f8fa' : '#171a1d';
  // The caption buttons sit on the app header strip (--header-bg), so they read as part of
  // the header while --window-border stays a thin frame. applyThemeToDOM() toggles
  // .light-theme before this runs, so the value is current.
  const headerBg = getComputedStyle(document.documentElement).getPropertyValue('--header-bg');

  const headerColor = sanitizeHexColor(headerBg, defaultHex);
  const symbolColor = getContrastingSymbolColor(headerColor, theme.base === 'vs');

  // Skip IPC dispatch if color values haven't changed (memoization)
  if (headerColor === lastTitleBarColor && symbolColor === lastSymbolColor) {
    return;
  }

  // Non-blocking async dispatch. The colors are remembered only once the main process accepted them,
  // so a failed call (for example right at startup) is retried by the next update instead of being skipped.
  window.engineAPI.setTitleBarOverlay({
    color: headerColor,
    symbolColor: symbolColor,
    height: 38
  }).then((res) => {
    if (res && res.success === false) return;
    lastTitleBarColor = headerColor;
    lastSymbolColor = symbolColor;
  }).catch(() => {});
}
