import { STORAGE_KEYS } from '../../core/constants.js';
import { loadTheme, safeSetMonacoTheme } from './themeLoader.js';

export const TONE_COLORS = {
  default: null,
  oled: { bg: '#000000', fg: '#f8fafc', gutter: '#000000', lineNo: '#64748b', isDark: true },
  dark_oled: { bg: '#000000', fg: '#f8fafc', gutter: '#000000', lineNo: '#64748b', isDark: true },
  obsidian: { bg: '#090d16', fg: '#e2e8f0', gutter: '#090d16', lineNo: '#64748b', isDark: true },
  dark_obsidian: { bg: '#090d16', fg: '#e2e8f0', gutter: '#090d16', lineNo: '#64748b', isDark: true },
  charcoal: { bg: '#111827', fg: '#f1f5f9', gutter: '#111827', lineNo: '#64748b', isDark: true },
  dark_charcoal: { bg: '#111827', fg: '#f1f5f9', gutter: '#111827', lineNo: '#64748b', isDark: true },
  slate: { bg: '#0f172a', fg: '#f8fafc', gutter: '#0f172a', lineNo: '#64748b', isDark: true },
  dark_slate: { bg: '#0f172a', fg: '#f8fafc', gutter: '#0f172a', lineNo: '#64748b', isDark: true },
  ivory: { bg: '#FFFFF0', fg: '#1c1917', gutter: '#fbfbf0', lineNo: '#78716c', isDark: false },
  light_ivory: { bg: '#FFFFF0', fg: '#1c1917', gutter: '#fbfbf0', lineNo: '#78716c', isDark: false },
  warmWhite: { bg: '#FAFAF9', fg: '#292524', gutter: '#f5f5f4', lineNo: '#78716c', isDark: false },
  light_warm: { bg: '#FAFAF9', fg: '#292524', gutter: '#f5f5f4', lineNo: '#78716c', isDark: false },
  snow: { bg: '#FFFFFF', fg: '#0f172a', gutter: '#f8fafc', lineNo: '#94a3b8', isDark: false },
  light_snow: { bg: '#FFFFFF', fg: '#0f172a', gutter: '#f8fafc', lineNo: '#94a3b8', isDark: false },
  paper: { bg: '#FDFBF7', fg: '#332f2c', gutter: '#f7f4ee', lineNo: '#78716c', isDark: false },
  light_paper: { bg: '#FDFBF7', fg: '#332f2c', gutter: '#f7f4ee', lineNo: '#78716c', isDark: false }
};

export function updateEditorOptions(options, editorInstances = []) {
  for (const ed of editorInstances) {
    if (ed) ed.updateOptions(options);
  }
}

export function applyEditorCanvasTone(tone, customBg = null, customFg = null, monacoRef = null) {
  const monaco = monacoRef || (typeof window !== 'undefined' ? window.monaco : null);
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
  } catch (_) {
    safeSetMonacoTheme('vs-dark', toneConfig.isDark ? 'vs-dark' : 'vs');
  }
}
