/**
 * Applies theme color mappings to document CSS variables.
 */

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
    if (theme.colors['button.background']) {
      setVar('--button-bg', theme.colors['button.background']);
    }
    if (theme.colors['button.foreground']) {
      setVar('--button-fg', theme.colors['button.foreground']);
    }
    if (theme.colors['dropdown.background']) {
      setVar('--dropdown-bg', theme.colors['dropdown.background']);
    }
  }

  // Light/Dark root class toggle
  const isLight = theme.base === 'vs';
  root.classList.toggle('light-theme', isLight);
  // Native controls (select popups, scrollbars, form fields) follow the theme, not the OS setting
  root.style.colorScheme = isLight ? 'light' : 'dark';
}
