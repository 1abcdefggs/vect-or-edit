export async function loadTheme(themeName) {
  // Dynamically import the JSON theme file from the themes directory.
  // Vite's import.meta.glob can also be used, but a dynamic import is simple here.
  const themeModule = await import(`./themes/${themeName}.json`);
  const theme = themeModule.default ?? themeModule; // Support both ES and CommonJS exports.

  const root = document.documentElement;

  // Map all theme colors to CSS custom properties (dash‑separated).
  if (theme.colors) {
    Object.entries(theme.colors).forEach(([key, value]) => {
      const cssVar = `--${key.replace(/\./g, '-')}`;
      root.style.setProperty(cssVar, value);
    });
  }

  // Future extensions: fonts, spacing, etc.
  return theme;
}
