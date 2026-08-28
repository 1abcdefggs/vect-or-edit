/**
 * Centralized Application Constants & Configuration Tokens
 * Eliminates magic strings, numbers, and hardcoded values across the renderer process.
 */

export const STORAGE_KEYS = {
  THEME: 'vect_theme',
  LEGACY_THEME: 'themeName',
  FONT_FAMILY: 'editor_fontFamily',
  FONT_SIZE: 'editor_fontSize',
  LINE_HEIGHT: 'editor_lineHeight',
  WORD_WRAP: 'editor_wordWrap',
  LINE_NUMBERS: 'editor_lineNumbers',
  LINE_HIGHLIGHT: 'editor_lineHighlight',
  STICKY_SCROLL: 'editor_stickyScroll',
  RENDER_WHITESPACE: 'editor_renderWhitespace',
  SUGGEST_TRIGGER_MODE: 'vect_suggest_trigger_mode',
  AI_PROVIDER: 'ai_provider',
  AI_INFERENCE_SCOPE: 'ai_inference_scope',
  EMBEDDER_PATH: 'embedder_path',
  CLAUDE_API_KEY: 'claude_api_key',
  CLAUDE_MODEL: 'claude_model',
  GEMINI_API_KEY: 'gemini_api_key',
  GEMINI_MODEL: 'gemini_model',
  OPENAI_API_KEY: 'openai_api_key',
  OPENAI_MODEL: 'openai_model',
  SHOW_FULL_METADATA: 'vect_show_full_metadata',
  APP_LANG: 'app_lang',
  LOG_DISPLAY_POSITION: 'logDisplayPosition',
  LOG_COLLAPSED_ON_STARTUP: 'log_collapsed_on_startup',
  EDITOR_BG_TONE: 'editor_bg_tone',
  CUSTOM_EDITOR_BG: 'editor_custom_bg',
  AUTO_SAVE: 'editor_auto_save',
  CONTEXT_MENU_PATTERN: 'vect_context_menu_pattern',
  SUGGEST_DISPLAY_TARGET: 'vect_suggest_display_target',
  AI_SETUP_COMPLETED: 'vect_ai_setup_completed'
};

export const TIMINGS = {
  SEARCH_DEBOUNCE_MS: 200,
  WORKER_TIMEOUT_MS: 2000,
  COPIED_TOOLTIP_RESET_MS: 1500,
  AUTO_SAVE_BASE_MS: 1500,
  AUTO_SAVE_HIGH_LOAD_MS: 4000
};

export const DEFAULTS = {
  MIN_SCORE_PCT: 50,
  SEARCH_LIMIT: 6,
  FONT_SIZE: 16,
  LINE_HEIGHT: 26,
  FONT_FAMILY: "'Source Serif 4', 'Noto Serif JP', Georgia, 'Times New Roman', serif",
  LOCAL_EMBEDDING_MODEL: 'Xenova/multilingual-e5-small',
  CLAUDE_MODEL: 'claude-3-5-sonnet-20241022',
  GEMINI_MODEL: 'gemini-1.5-flash',
  OPENAI_MODEL: 'gpt-4o-mini',
  AI_INFERENCE_SCOPE: 'suggestion_only',
  SUGGEST_TRIGGER_MODE: 'selection',
  AI_PROVIDER: 'local',
  APP_LANG: 'ja',
  AUTO_SAVE: true,
  LOG_DISPLAY_POSITION: 'bottom',
  LOG_COLLAPSED_ON_STARTUP: false,
  CONTEXT_MENU_PATTERN: 'patternA',
  SUGGEST_DISPLAY_TARGET: 'sidebar'
};

export const LOG_COLORS = {
  ERROR: 'var(--error-color, #ef4444)',
  WARN: 'var(--warn-color, #f59e0b)',
  INFO: 'var(--accent-color, #38bdf8)'
};
