import { STORAGE_KEYS } from '../../core/constants.js';
import { loadTheme, safeSetMonacoTheme } from './themeLoader.js';

export const TONE_COLORS = {
  default: null,
  oled: { bg: '#000000', fg: '#f8fafc', gutter: '#000000', lineNo: '#475569', isDark: true },
  dark_oled: { bg: '#000000', fg: '#f8fafc', gutter: '#000000', lineNo: '#475569', isDark: true },
  snow: { bg: '#FFFFFF', fg: '#0f172a', gutter: '#f8fafc', lineNo: '#94a3b8', isDark: false },
  light_snow: { bg: '#FFFFFF', fg: '#0f172a', gutter: '#f8fafc', lineNo: '#94a3b8', isDark: false },
};

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
  if (!monaco || !monaco.editor) return;

  const currentTone = tone || localStorage.getItem(STORAGE_KEYS.EDITOR_BG_TONE) || 'default';

  if (currentTone === 'custom') {
    const bg = customBg || localStorage.getItem(STORAGE_KEYS.CUSTOM_EDITOR_BG) || '#1e1e2e';
    const fg = customFg || localStorage.getItem(STORAGE_KEYS.CUSTOM_EDITOR_FG) || '#cdd6f4';

    const hex = bg.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) || 0;
    const g = parseInt(hex.substr(2, 2), 16) || 0;
    const b = parseInt(hex.substr(4, 2), 16) || 0;
    const isDark = (r * 299 + g * 587 + b * 114) / 1000 < 128;

    try {
      monaco.editor.defineTheme('custom-user-colors', {
        base: isDark ? 'vs-dark' : 'vs',
        inherit: true,
        rules: [{ token: '', foreground: fg.replace('#', '') }],
        colors: {
          'editor.background': bg,
          'editor.foreground': fg,
          'editorGutter.background': bg,
          'editorLineNumber.foreground': isDark ? '#64748b' : '#94a3b8',
          'editorLineNumber.activeForeground': '#38bdf8'
        }
      });
      monaco.editor.setTheme('custom-user-colors');
    } catch (_) {
      safeSetMonacoTheme('vs-dark', isDark ? 'vs-dark' : 'vs');
    }
    return;
  }

  if (currentTone === 'default' || !TONE_COLORS[currentTone]) {
    const activeTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'auto';
    loadTheme(activeTheme).catch(() => {});
    return;
  }

  const toneConfig = TONE_COLORS[currentTone];
  const customThemeName = `custom-tone-${currentTone}`;

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
  } catch (_) {
    safeSetMonacoTheme('vs-dark', toneConfig.isDark ? 'vs-dark' : 'vs');
  }
}
