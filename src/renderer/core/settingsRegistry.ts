import { AppSettings, SettingItemDef } from '../types/settings';
import { DEFAULTS } from './constants';

export const DEFAULT_SETTINGS: AppSettings = {
  version: '0.3.12',
  preferences: {
    header: {
      theme: 'Dracula',
      locale: 'en',
      uiScale: '1.0',
      windowWidth: 1200,
      windowHeight: 800
    },
    editor: {
      fontFamily: DEFAULTS.FONT_FAMILY,
      fontSize: '16px',
      lineWrapping: 'on',
      minimap: false,
      aiAssistEnabled: false,
      llmProvider: 'gemini',
      llmModel: 'gemini-3.1-flash-lite',
      inferenceScope: 'suggestion_only'
    },
    sidebar: {
      embeddingSource: 'local',
      minSimilarityScore: 70,
      maxSuggestionsLimit: 5,
      searchTrigger: 'selection',
      contextMenuLayout: 'pattern_a',
      fullMetadata: false,
      linterEnabled: true
    },
    system: {
      collapseLogsOnStartup: false,
      logTimeFormat: 'h24',
      logTimeZone: 'local',
      logSaveMode: 'never'
    }
  },
  visibility: {
    'hdr:logo': true,
    'hdr:menu-bar': true,
    'hdr:menu-file': true,
    'hdr:menu-edit': true,
    'hdr:menu-view': true,
    'hdr:menu-window': true,
    'hdr:menu-help': true,
    'hdr:menu-overflow': true,
    'hdr:theme-select': true,
    'hdr:color-mode': true,
    'hdr:zoom-select': true,
    'hdr:settings-btn': true,
    'hdr:minimize': true,
    'edt:toolbar': true,
    'edt:font-family': true,
    'edt:font-size': true,
    'edt:ai-toggle': true,
    'edt:quick-settings': true,
    'edt:save': true,
    'edt:bg-tone': true,
    'edt:tab-bar': true,
    'edt:status-bar': true,
    'edt:document-format': true,
    'edt:markdown-preview': true,
    'edt:llm-dock': true,
    'edt:llm-key-config': true,
    'edt:llm-clear-chat': true,
    'edt:llm-collapse': true,
    'edt:llm-close': true,
    'sbr:sidebar': true,
    'sbr:score-filter': true,
    'sbr:limit-select': true,
    'sbr:metadata-toggle': true,
    'sbr:metadata-fields': true,
    'sbr:quick-settings': true,
    'sbr:embedding-toggle': true,
    'sbr:import-dictionary': true,
    'sbr:add-slot': true,
    'sbr:rail': true,
    'sbr:guideline-card': true,
    'sbr:knowledge-card': true,
    'sbr:editor-options-card': false,
    'sys:bottom-bar': true,
    'sys:status-meta': true,
    'sys:pipeline-meter': true,
    'sys:log-console': true,
    'sys:quick-settings': true,
    'sys:log-clear': true,
    'sys:log-copy': true,
    'sys:log-download': true,
    'sys:update-status': true,
    'sys:save-status': true
  }
};

export const SETTINGS_REGISTRY: SettingItemDef[] = [
  // ── 1. HEADER & APPEARANCE ──
  {
    id: 'h_logo',
    category: 'header',
    visibilityKey: 'hdr:logo',
    controlType: 'none'
  },
  {
    id: 'h_menu_bar',
    category: 'header',
    visibilityKey: 'hdr:menu-bar',
    hideNoticeKey: 'hide_notice_menu_bar',
    controlType: 'none'
  },
  {
    id: 'h_menu_file',
    category: 'header',
    visibilityKey: 'hdr:menu-file',
    controlType: 'none'
  },
  {
    id: 'h_menu_edit',
    category: 'header',
    visibilityKey: 'hdr:menu-edit',
    controlType: 'none'
  },
  {
    id: 'h_menu_view',
    category: 'header',
    visibilityKey: 'hdr:menu-view',
    controlType: 'none'
  },
  {
    id: 'h_menu_window',
    category: 'header',
    visibilityKey: 'hdr:menu-window',
    controlType: 'none'
  },
  {
    id: 'h_menu_help',
    category: 'header',
    visibilityKey: 'hdr:menu-help',
    controlType: 'none'
  },
  {
    id: 'h_menu_overflow',
    category: 'header',
    visibilityKey: 'hdr:menu-overflow',
    controlType: 'none'
  },
  {
    id: 'h_color_mode',
    category: 'header',
    visibilityKey: 'hdr:color-mode',
    controlType: 'select',
    options: [
      { value: 'system' },
      { value: 'light' },
      { value: 'dark' }
    ]
  },
  {
    id: 'h_theme',
    category: 'header',
    prefPath: 'header.theme',
    visibilityKey: 'hdr:theme-select',
    controlType: 'select',
    options: [
      { value: 'Dracula' },
      { value: 'GitHub' },
      { value: 'Monokai' },
      { value: 'Night Owl' },
      { value: 'Tukune' }
    ]
  },
  {
    id: 'h_locale',
    category: 'header',
    prefPath: 'header.locale',
    controlType: 'select',
    options: [
      { value: 'en' },
      { value: 'ja' }
    ]
  },
  {
    id: 'h_zoom',
    category: 'header',
    prefPath: 'header.uiScale',
    visibilityKey: 'hdr:zoom-select',
    controlType: 'select',
    options: [
      { value: '1.0' },
      { value: '1.1' },
      { value: '1.25' },
      { value: '1.4' },
      { value: '1.5' }
    ]
  },
  {
    id: 'h_settings_btn',
    category: 'header',
    visibilityKey: 'hdr:settings-btn',
    controlType: 'none',
    isEssential: true
  },
  {
    id: 'h_minimize_btn',
    category: 'header',
    visibilityKey: 'hdr:minimize',
    controlType: 'none'
  },

  // ── 2. EDITOR & GENERATIVE AI ──
  {
    id: 'ed_toolbar',
    category: 'editor',
    visibilityKey: 'edt:toolbar',
    controlType: 'none'
  },
  {
    id: 'ed_font_family',
    category: 'editor',
    prefPath: 'editor.fontFamily',
    visibilityKey: 'edt:font-family',
    controlType: 'select',
    options: [
      { value: "'Source Serif 4', 'Noto Serif JP', Georgia, serif" },
      { value: "'Source Sans 3', 'Noto Sans JP', sans-serif" },
      { value: "'Source Code Pro', 'Cascadia Code', monospace" }
    ]
  },
  {
    id: 'ed_font_size',
    category: 'editor',
    prefPath: 'editor.fontSize',
    visibilityKey: 'edt:font-size',
    controlType: 'select',
    options: [
      { value: '14px' },
      { value: '16px' },
      { value: '18px' },
      { value: '20px' }
    ]
  },
  {
    id: 'ed_ai_toggle',
    category: 'editor',
    prefPath: 'editor.aiAssistEnabled',
    visibilityKey: 'edt:ai-toggle',
    controlType: 'toggle'
  },
  {
    id: 'ed_quick_settings',
    category: 'editor',
    visibilityKey: 'edt:quick-settings',
    controlType: 'none'
  },
  {
    id: 'ed_llm_provider',
    category: 'editor',
    prefPath: 'editor.llmProvider',
    controlType: 'select',
    options: [
      { value: 'gemini' },
      { value: 'claude' },
      { value: 'openai' }
    ]
  },
  {
    id: 'ed_inference_scope',
    category: 'editor',
    prefPath: 'editor.inferenceScope',
    controlType: 'select',
    options: [
      { value: 'suggestion_only' },
      { value: 'lint_assist' },
      { value: 'full_assist' }
    ]
  },

  {
    id: 'ed_save',
    category: 'editor',
    visibilityKey: 'edt:save',
    hideNoticeKey: 'hide_notice_save',
    controlType: 'none'
  },
  {
    id: 'ed_bg_tone',
    category: 'editor',
    visibilityKey: 'edt:bg-tone',
    controlType: 'none'
  },
  {
    id: 'ed_tab_bar',
    category: 'editor',
    visibilityKey: 'edt:tab-bar',
    hideNoticeKey: 'hide_notice_tab_bar',
    controlType: 'none'
  },
  {
    id: 'ed_status_bar',
    category: 'editor',
    visibilityKey: 'edt:status-bar',
    controlType: 'none'
  },
  {
    id: 'ed_document_format',
    category: 'editor',
    visibilityKey: 'edt:document-format',
    controlType: 'none'
  },
  {
    id: 'ed_markdown_preview',
    category: 'editor',
    visibilityKey: 'edt:markdown-preview',
    controlType: 'none'
  },
  {
    id: 'ed_llm_dock',
    category: 'editor',
    visibilityKey: 'edt:llm-dock',
    controlType: 'none'
  },
  {
    id: 'ed_llm_key_config',
    category: 'editor',
    visibilityKey: 'edt:llm-key-config',
    controlType: 'none'
  },
  {
    id: 'ed_llm_clear_chat',
    category: 'editor',
    visibilityKey: 'edt:llm-clear-chat',
    controlType: 'none'
  },
  {
    id: 'ed_llm_collapse',
    category: 'editor',
    visibilityKey: 'edt:llm-collapse',
    controlType: 'none'
  },
  {
    id: 'ed_llm_close',
    category: 'editor',
    visibilityKey: 'edt:llm-close',
    controlType: 'none'
  },

  // ── 3. KNOWLEDGE & VECTOR SIDEBAR ──
  {
    id: 'sb_sidebar',
    category: 'sidebar',
    visibilityKey: 'sbr:sidebar',
    hideNoticeKey: 'hide_notice_sidebar',
    controlType: 'none'
  },
  {
    id: 'sb_score_filter',
    category: 'sidebar',
    prefPath: 'sidebar.minSimilarityScore',
    visibilityKey: 'sbr:score-filter',
    controlType: 'number'
  },
  {
    id: 'sb_limit_select',
    category: 'sidebar',
    prefPath: 'sidebar.maxSuggestionsLimit',
    visibilityKey: 'sbr:limit-select',
    controlType: 'select',
    options: [
      { value: 5 },
      { value: 10 },
      { value: 20 }
    ]
  },
  {
    id: 'sb_metadata_toggle',
    category: 'sidebar',
    prefPath: 'sidebar.fullMetadata',
    visibilityKey: 'sbr:metadata-toggle',
    controlType: 'toggle'
  },
  {
    id: 'sb_metadata_fields',
    category: 'sidebar',
    visibilityKey: 'sbr:metadata-fields',
    controlType: 'none'
  },
  {
    id: 'sb_quick_settings',
    category: 'sidebar',
    visibilityKey: 'sbr:quick-settings',
    controlType: 'none'
  },
  {
    id: 'sb_emb_source',
    category: 'sidebar',
    prefPath: 'sidebar.embeddingSource',
    controlType: 'select',
    options: [
      { value: 'local' },
      { value: 'gemini' },
      { value: 'openai' }
    ]
  },
  {
    id: 'sb_trigger_mode',
    category: 'sidebar',
    prefPath: 'sidebar.searchTrigger',
    controlType: 'select',
    options: [
      { value: 'selection' },
      { value: 'contextmenu' },
      { value: 'manual' }
    ]
  },
  {
    id: 'sb_linter',
    category: 'sidebar',
    prefPath: 'sidebar.linterEnabled',
    controlType: 'toggle'
  },

  {
    id: 'sb_embedding_toggle',
    category: 'sidebar',
    visibilityKey: 'sbr:embedding-toggle',
    controlType: 'none'
  },
  {
    id: 'sb_import_dictionary',
    category: 'sidebar',
    visibilityKey: 'sbr:import-dictionary',
    controlType: 'none'
  },
  {
    id: 'sb_add_slot',
    category: 'sidebar',
    visibilityKey: 'sbr:add-slot',
    controlType: 'none'
  },
  {
    id: 'sb_rail',
    category: 'sidebar',
    visibilityKey: 'sbr:rail',
    controlType: 'none'
  },

  {
    id: 'sb_guideline_card',
    category: 'sidebar',
    visibilityKey: 'sbr:guideline-card',
    hideNoticeKey: 'hide_notice_guideline_card',
    controlType: 'none'
  },
  {
    id: 'sb_knowledge_card',
    category: 'sidebar',
    visibilityKey: 'sbr:knowledge-card',
    hideNoticeKey: 'hide_notice_knowledge_card',
    controlType: 'none'
  },
  {
    id: 'sb_editor_options_card',
    category: 'sidebar',
    visibilityKey: 'sbr:editor-options-card',
    controlType: 'none'
  },

  // ── 4. SYSTEM & BOTTOM BAR ──
  {
    id: 'sys_bottom_bar',
    category: 'system',
    visibilityKey: 'sys:bottom-bar',
    hideNoticeKey: 'hide_notice_bottom_bar',
    controlType: 'none'
  },
  {
    id: 'sys_status_bar',
    category: 'system',
    visibilityKey: 'sys:status-meta',
    controlType: 'none'
  },
  {
    id: 'sys_pipeline_meter',
    category: 'system',
    visibilityKey: 'sys:pipeline-meter',
    controlType: 'none'
  },
  {
    id: 'sys_log_console',
    category: 'system',
    visibilityKey: 'sys:log-console',
    controlType: 'none'
  },
  {
    id: 'sys_quick_settings',
    category: 'system',
    visibilityKey: 'sys:quick-settings',
    controlType: 'none'
  },
  {
    id: 'sys_collapse_logs',
    category: 'system',
    prefPath: 'system.collapseLogsOnStartup',
    controlType: 'toggle'
  },
  {
    id: 'sys_log_save',
    category: 'system',
    prefPath: 'system.logSaveMode',
    controlType: 'select'
  },
  {
    id: 'sys_log_clear',
    category: 'system',
    visibilityKey: 'sys:log-clear',
    controlType: 'none'
  },
  {
    id: 'sys_log_copy',
    category: 'system',
    visibilityKey: 'sys:log-copy',
    controlType: 'none'
  },
  {
    id: 'sys_log_download',
    category: 'system',
    visibilityKey: 'sys:log-download',
    controlType: 'none'
  },
  {
    id: 'sys_update_status',
    category: 'system',
    visibilityKey: 'sys:update-status',
    controlType: 'none'
  },
  {
    id: 'sys_save_status',
    category: 'system',
    visibilityKey: 'sys:save-status',
    controlType: 'none'
  }
];
