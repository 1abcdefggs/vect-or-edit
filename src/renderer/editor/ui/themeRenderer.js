/**
 * Applies theme color mappings to document CSS variables.
 */
import { mixColors, contrastRatio, readableOn, SKELETON_ACCENT } from '../core/themeSkeleton.js';
import { TINT_ALPHA, deriveTextColours } from '../core/derivedColors.js';

function rgbaOf(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * The colour variables that follow the theme (accent, text and border, log console, shared tints).
 * Status colours, overlays, backdrop and shadows stay per mode on purpose (see variables.css).
 * A value that would fall below the contrast limit is not set, so the stylesheet's mode default applies.
 */
function applyDerivedColors(theme, setVar) {
  const colors = theme.colors;
  const isLight = theme.base === 'vs';
  const bg = sanitizeHexColor(colors['editor.background'], isLight ? '#ffffff' : '#1e1e1e');
  const fg = sanitizeHexColor(colors['editor.foreground'], isLight ? '#111111' : '#ffffff');
  const panel = sanitizeHexColor(colors['sideBar.background'], bg);
  const accent = sanitizeHexColor(colors['button.background'], SKELETON_ACCENT);
  const alpha = isLight ? TINT_ALPHA.light : TINT_ALPHA.dark;
  const derived = deriveTextColours({ bg, fg, panel, accent, isLight });

  // Accent and text on the accent
  setVar('--accent-color', accent);
  setVar('--accent-hover', mixColors(accent, '#000000', 0.15));
  setVar('--text-on-accent', readableOn(accent));
  setVar('--item-code-text', derived.itemCodeText);

  // Muted text and control outline: kept only when they meet the contrast limit
  const muted = mixColors(fg, bg, 0.25);
  if (contrastRatio(muted, bg) >= 4.5) setVar('--text-muted', muted);
  const border = sanitizeHexColor(colors['editorGroup.border'], '');
  if (border && contrastRatio(border, bg) >= 3) setVar('--control-border', border);

  // System log console, from the editor colours. The source and time sit on the log body, so they fit to it.
  setVar('--log-bg', bg);
  setVar('--log-header-bg', derived.logHeader);
  setVar('--log-fg', fg);
  setVar('--log-title', fg);
  setVar('--log-msg', fg);
  setVar('--log-time', derived.logMuted);
  setVar('--log-source', derived.logMuted);

  // Shared tints: the theme's text or accent colour at the mode's alpha
  setVar('--hover-bg', rgbaOf(fg, alpha.hover));
  setVar('--active-bg', rgbaOf(fg, alpha.active));
  setVar('--result-bg', rgbaOf(fg, alpha.result));
  setVar('--result-hover-bg', rgbaOf(accent, alpha.resultHover));
  setVar('--item-code-bg', rgbaOf(accent, alpha.itemCode));
  setVar('--select-bg', rgbaOf(panel, alpha.select));
  setVar('--select-text', fg);
  setVar('--select-border', rgbaOf(fg, alpha.selectBorder));
}

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

// Variables the previous theme set inline; cleared before the next theme applies so a key the new theme lacks
// falls back to the stylesheet default instead of keeping the old theme's color.
const appliedVars = new Set();

export function applyThemeToDOM(theme) {
  if (typeof document === 'undefined' || !theme) return;
  const root = document.documentElement;

  appliedVars.forEach((name) => root.style.removeProperty(name));
  appliedVars.clear();
  const setVar = (name, value) => {
    root.style.setProperty(name, value);
    appliedVars.add(name);
  };

  // Map all theme colors to CSS custom properties (dash-separated).
  if (theme.colors) {
    Object.entries(theme.colors).forEach(([key, value]) => {
      setVar(`--${key.replace(/\./g, '-')}`, value);
    });

    // Update core app UI variables for consistent theme experience
    if (theme.colors['editor.background']) {
      setVar('--bg-secondary', theme.colors['editor.background']);
      setVar('--editor-bg', theme.colors['editor.background']);
    }
    if (theme.colors['sideBar.background']) {
      setVar('--bg-primary', theme.colors['sideBar.background']);
      setVar('--bg-card', theme.colors['sideBar.background']);
    }
    if (theme.colors['editor.foreground']) {
      setVar('--text-main', theme.colors['editor.foreground']);
      setVar('--editor-fg', theme.colors['editor.foreground']);
    }
    const rawHeaderColor = theme.colors['titleBar.activeBackground']
      || theme.colors['editor.background']
      || (theme.base === 'vs' ? '#f6f8fa' : '#171a1d');
    const headerBgColor = sanitizeHexColor(rawHeaderColor, theme.base === 'vs' ? '#f6f8fa' : '#171a1d');
    setVar('--header-bg', headerBgColor);

    const rawHeaderFgColor = theme.colors['titleBar.activeForeground']
      || theme.colors['editor.foreground']
      || (theme.base === 'vs' ? '#111111' : '#ffffff');
    const headerFgColor = sanitizeHexColor(rawHeaderFgColor, theme.base === 'vs' ? '#111111' : '#ffffff');
    setVar('--header-fg', headerFgColor);

    if (theme.colors['editorGroup.border']) {
      setVar('--border-color', theme.colors['editorGroup.border']);
    }
    applyDerivedColors(theme, setVar);
  }

  // Light/Dark root class toggle
  const isLight = theme.base === 'vs';
  root.classList.toggle('light-theme', isLight);
  // Native controls (select popups, scrollbars, form fields) follow the theme, not the OS setting
  root.style.colorScheme = isLight ? 'light' : 'dark';
}
