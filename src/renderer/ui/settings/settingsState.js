import { STORAGE_KEYS, DEFAULTS } from '../../core/constants.js';

export function isAiModelConfigured() {
  const provider = localStorage.getItem('ai_provider') || 'local';
  if (provider === 'local') return Boolean(window.__isLocalAiModelReady);
  if (provider === 'claude') return Boolean(localStorage.getItem('claude_api_key'));
  if (provider === 'gemini') return Boolean(localStorage.getItem('gemini_api_key'));
  if (provider === 'openai') return Boolean(localStorage.getItem('openai_api_key'));
  return false;
}

export function getEditorSettings() {
  return {
    fontFamily: localStorage.getItem('editor_fontFamily') || DEFAULTS.FONT_FAMILY,
    fontSize: parseInt(localStorage.getItem('editor_fontSize') || String(DEFAULTS.FONT_SIZE), 10),
    lineHeight: parseInt(localStorage.getItem('editor_lineHeight') || String(DEFAULTS.LINE_HEIGHT), 10),
    wordWrap: localStorage.getItem('editor_wordWrap') || 'on',
    lineNumbers: localStorage.getItem('editor_lineNumbers') || 'on',
    renderLineHighlight: localStorage.getItem('editor_renderLineHighlight') || 'line',
    stickyScroll: (localStorage.getItem('editor_stickyScroll') || 'on') === 'on',
    renderWhitespace: localStorage.getItem('editor_renderWhitespace') || 'none',
    editorBgTone: localStorage.getItem('editor_bg_tone') || 'default',
    customBg: localStorage.getItem('editor_custom_bg') || '#1e1e2e',
    customFg: localStorage.getItem('editor_custom_fg') || '#cdd6f4',
  };
}

export function saveEditorSettings(settings) {
  Object.keys(settings).forEach(key => {
    localStorage.setItem(`editor_${key}`, String(settings[key]));
  });
}
