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

export function applyThemeToDOM(theme) {
  if (typeof document === 'undefined' || !theme) return;
  const root = document.documentElement;

  // Map all theme colors to CSS custom properties (dash-separated).
  if (theme.colors) {
    Object.entries(theme.colors).forEach(([key, value]) => {
      const cssVar = `--${key.replace(/\./g, '-')}`;
      root.style.setProperty(cssVar, value);
    });

    // Update core app UI variables for consistent theme experience
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
}
