import { STORAGE_KEYS } from '../../core/constants.js';
import { readStorage } from '../../core/storage.js';
import { loadTheme, safeSetMonacoTheme, getStoredThemeSetting } from './themeLoader.js';
import { buildThemeFromPalette, SKELETON_ACCENT } from './themeSkeleton.js';

import { TONE_PAIRS, LEGACY_TONES, pairFor } from './editorTonePairs.js';

const toneOf = ({ bg, fg, gutter, lineNo, isDark }) => ({ bg, fg, gutter, lineNo, isDark });

// One entry per tone, built from the pair table (editorTonePairs.js). The old OLED and Snow values stay as names of the crisp / crisp pairs.
export const TONE_COLORS = {
  default: null,
  ...Object.fromEntries(TONE_PAIRS.map((pair) => [pair.key, toneOf(pair)])),
  ...Object.fromEntries(Object.keys(LEGACY_TONES).map((legacy) => [legacy, toneOf(pairFor(legacy))]))
};


// loadTheme resets Monaco and the editor variables to the theme's own; a non-default canvas tone is applied again on top
if (typeof window !== 'undefined') {
  window.addEventListener('app:themeApplied', () => {
    const tone = readStorage(STORAGE_KEYS.EDITOR_BG_TONE) || 'default';
    if (tone !== 'default') applyEditorCanvasTone(tone);
  });
}

export function updateEditorOptions(options, editorInstances = []) {
  for (const ed of editorInstances) {
    if (ed) ed.updateOptions(options);
  }
}

export async function applyEditorCanvasTone(tone, customBg = null, customFg = null, monacoRef = null) {
  let monaco = monacoRef || (typeof window !== 'undefined' ? window.monaco : null);
  if (!monaco || !monaco.editor) {
    try {
      monaco = await import('monaco-editor');
      if (typeof window !== 'undefined') window.monaco = monaco;
    } catch (_) {}
  }
  if (!monaco || !monaco.editor) {
    console.warn('[Tone] Monaco is not loaded, so the canvas tone was not applied');
    return;
  }

  const currentTone = tone || readStorage(STORAGE_KEYS.EDITOR_BG_TONE) || 'default';

  if (currentTone === 'custom') {
    const bg = customBg || readStorage(STORAGE_KEYS.CUSTOM_EDITOR_BG) || '#1e1e2e';
    const fg = customFg || readStorage(STORAGE_KEYS.CUSTOM_EDITOR_FG) || '#cdd6f4';

    const hex = bg.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) || 0;
    const g = parseInt(hex.substr(2, 2), 16) || 0;
    const b = parseInt(hex.substr(4, 2), 16) || 0;
    const isDark = (r * 299 + g * 587 + b * 114) / 1000 < 128;

    try {
      // Custom is a full theme: every colour is derived from the two picked colours by the skeleton
      const full = buildThemeFromPalette({ base: isDark ? 'vs-dark' : 'vs', background: bg, foreground: fg });
      monaco.editor.defineTheme('custom-user-colors', {
        ...full,
        rules: [{ token: '', foreground: fg.replace('#', '') }],
        colors: {
          ...full.colors,
          'editorGutter.background': bg,
          'editorLineNumber.activeForeground': SKELETON_ACCENT
        }
      });
      monaco.editor.setTheme('custom-user-colors');
      if (typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--editor-bg', bg);
        document.documentElement.style.setProperty('--editor-fg', fg);
        window.dispatchEvent(new CustomEvent('app:editorToneChanged', { detail: { tone: 'custom', bg, fg, isDark } }));
      }
    } catch (err) {
      console.warn('[Tone] Could not apply the custom canvas colours:', err);
      safeSetMonacoTheme('vs-dark', isDark ? 'vs-dark' : 'vs');
    }
    return;
  }

  if (currentTone === 'default' || !TONE_COLORS[currentTone]) {
    loadTheme(getStoredThemeSetting()).catch(() => {});
    return;
  }

  const toneConfig = TONE_COLORS[currentTone];
  // Monaco accepts only letters, digits and hyphens in a theme name; the tone keys contain underscores (light_soft_crisp)
  const customThemeName = `custom-tone-${currentTone.replace(/[^a-zA-Z0-9-]/g, '-')}`;

  try {
    monaco.editor.defineTheme(customThemeName, {
      base: toneConfig.isDark ? 'vs-dark' : 'vs',
      inherit: true,
      rules: [{ token: '', foreground: toneConfig.fg.replace('#', '') }],
      colors: {
        'editor.background': toneConfig.bg,
        'editor.foreground': toneConfig.fg,
        'editorGutter.background': toneConfig.gutter,
        'editorLineNumber.foreground': toneConfig.lineNo,
        'editorLineNumber.activeForeground': '#38bdf8'
      }
    });
    monaco.editor.setTheme(customThemeName);

    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--editor-bg', toneConfig.bg);
      document.documentElement.style.setProperty('--editor-fg', toneConfig.fg);
      window.dispatchEvent(new CustomEvent('app:editorToneChanged', {
        detail: { tone: currentTone, bg: toneConfig.bg, fg: toneConfig.fg, isDark: toneConfig.isDark }
      }));
    }
  } catch (err) {
    console.warn(`[Tone] Could not apply the canvas tone "${currentTone}":`, err);
    safeSetMonacoTheme('vs-dark', toneConfig.isDark ? 'vs-dark' : 'vs');
  }
}
