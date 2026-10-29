/**
 * Centralized Application Constants & Configuration Tokens
 * Eliminates magic strings, numbers, and hardcoded values across the renderer process.
 */

export const STORAGE_KEYS = {
  THEME: 'vect_theme',
  LEGACY_THEME: 'themeName',
  COLOR_MODE: 'vect_color_mode',
  FONT_FAMILY: 'editor_fontFamily',
  FONT_SIZE: 'editor_fontSize',
  LINE_HEIGHT: 'editor_lineHeight',
  WORD_WRAP: 'editor_wordWrap',
  LINE_NUMBERS: 'editor_lineNumbers',
  LINE_HIGHLIGHT: 'editor_lineHighlight',
  STICKY_SCROLL: 'editor_stickyScroll',
  RENDER_WHITESPACE: 'editor_renderWhitespace',
  // JSON object of Monaco option overrides keyed by option path (editor/options/monacoOptionsModel.js)
  MONACO_OPTIONS: 'editor_monacoOptions',
  SUGGEST_TRIGGER_MODE: 'vect_suggest_trigger_mode',
  AI_PROVIDER: 'ai_provider',
  LLM_PROVIDER: 'llm_provider',
  AI_INFERENCE_SCOPE: 'ai_inference_scope',
  // *_API_KEY: plain-text names from older versions, read only to migrate them (core/apiKeyStore.js)
  CLAUDE_API_KEY: 'claude_api_key',
  CLAUDE_MODEL: 'claude_model',
  GEMINI_API_KEY: 'gemini_api_key',
  GEMINI_MODEL: 'gemini_model',
  OPENAI_API_KEY: 'openai_api_key',
  OPENAI_MODEL: 'openai_model',
  SHOW_FULL_METADATA: 'vect_show_full_metadata',
  APP_LANG: 'app_lang',
  EDITOR_BG_TONE: 'editor_bg_tone',
  CUSTOM_EDITOR_BG: 'editor_custom_bg',
  CUSTOM_EDITOR_FG: 'editor_custom_fg',
  AUTO_SAVE: 'editor_auto_save',
  // The two triggers of AutoSave: a pause in typing, and each new line (both on by default)
  AUTO_SAVE_IDLE: 'editor_auto_save_idle',
  AUTO_SAVE_NEWLINE: 'editor_auto_save_newline',
  // Pause before the save, in milliseconds (the user sets it in first-run setup)
  AUTO_SAVE_DELAY: 'editor_auto_save_delay_ms',
  // 'markdown' | 'text': the format new documents start in (src/shared/documentFormat.ts)
  DOCUMENT_FORMAT: 'vect_document_format',
  /** 'on' | 'off': ask before closing with × (off closes at once; unsaved tabs are always asked about) */
  CONFIRM_BEFORE_CLOSE: 'vect_confirm_before_close',
  /** 'off' once the "Don't show again" checkbox is ticked on a clean tab; the global switch above sets it back to 'on' */
  CONFIRM_TAB_CLOSE: 'vect_confirm_tab_close',
  AI_SETUP_COMPLETED: 'vect_ai_setup_completed',
  LOCAL_EMBEDDING_MODEL: 'vect_local_embedding_model',
  /** JSON array of embedding model ids whose files were fetched on this device */
  EMBEDDING_MODELS_DOWNLOADED: 'vect_embedding_models_downloaded',
  /** 'on' | 'off': real-time validation (engine linter) in the editor */
  LINTER_ENABLED: 'vect_linter_enabled',
  /** Minimum similarity score (percent) and number of results for knowledge suggestions */
  MIN_SCORE_PCT: 'vect_min_score_pct',
  SEARCH_LIMIT: 'vect_search_limit',
  /** JSON { languages, extra, sort }: the embedding model picker's content languages and sort order */
  EMBEDDING_PICKER_PREFS: 'vect_embedding_picker_prefs',
  /** Active Vectorizer source: 'local' | 'llm-embed-gemini' | 'llm-embed-claude' | 'llm-embed-openai' */
  EMBEDDING_SOURCE: 'vect_embedding_source',
  /** 'off': never cut dictionary or query vectors to a shorter length (docs 04_10); anything else allows it */
  EMBEDDING_TRUNCATION: 'vect_embedding_truncation'
} as const;

export const TIMINGS = {
  SEARCH_DEBOUNCE_MS: 200,
  WORKER_TIMEOUT_MS: 2000,
  COPIED_TOOLTIP_RESET_MS: 1500,
  AUTO_SAVE_BASE_MS: 1500,
  AUTO_SAVE_HIGH_LOAD_MS: 4000
} as const;

export const DEFAULTS = {
  // The same values the score fields and limit menus start with (settingsModal.html, suggestionSidebar.html)
  MIN_SCORE_PCT: 70,
  SEARCH_LIMIT: 5,
  FONT_SIZE: 16,
  LINE_HEIGHT: 26,
  FONT_FAMILY: "'Source Serif 4', 'Noto Serif JP', Georgia, 'Times New Roman', serif",
  LOCAL_EMBEDDING_MODEL: 'Xenova/multilingual-e5-small',
  CLAUDE_MODEL: 'claude-opus-5-5',
  GEMINI_MODEL: 'gemini-3.1-flash-lite',
  OPENAI_MODEL: 'gpt-4o-mini',
  AI_INFERENCE_SCOPE: 'suggestion_only',
  SUGGEST_TRIGGER_MODE: 'selection',
  AI_PROVIDER: 'local',
  LLM_PROVIDER: 'none',
  /** Default Vectorizer source */
  EMBEDDING_SOURCE: 'local',
  APP_LANG: 'en',
  AUTO_SAVE: true,
  AUTO_SAVE_IDLE: true,
  AUTO_SAVE_NEWLINE: true,
  CONFIRM_BEFORE_CLOSE: 'on',
  CONFIRM_TAB_CLOSE: 'on',
} as const;
