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
