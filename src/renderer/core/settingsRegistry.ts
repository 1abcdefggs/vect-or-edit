import { AppSettings, SettingItemDef } from '../types/settings';

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
      fontFamily: "'Source Code Pro', monospace",
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
      logTimeZone: 'local'
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
    label: 'Logo & App Version',
    description: 'Application branding and release version indicator in titlebar.',
    category: 'header',
    visibilityKey: 'hdr:logo',
    controlType: 'none'
  },
  {
    id: 'h_menu_bar',
    label: 'Application Menu Bar',
    description: 'Top-level menu bar container (File, Edit, View, Window, Help).',
    category: 'header',
    visibilityKey: 'hdr:menu-bar',
    hideNoticeKey: 'hide_notice_menu_bar',
    controlType: 'none'
  },
  {
    id: 'h_menu_file',
    label: 'Menu: [File]',
    category: 'header',
    visibilityKey: 'hdr:menu-file',
    controlType: 'none'
  },
  {
    id: 'h_menu_edit',
    label: 'Menu: [Edit]',
    category: 'header',
    visibilityKey: 'hdr:menu-edit',
    controlType: 'none'
  },
  {
    id: 'h_menu_view',
    label: 'Menu: [View]',
    category: 'header',
    visibilityKey: 'hdr:menu-view',
    controlType: 'none'
  },
  {
    id: 'h_menu_window',
    label: 'Menu: [Window]',
    category: 'header',
    visibilityKey: 'hdr:menu-window',
    controlType: 'none'
  },
  {
    id: 'h_menu_help',
    label: 'Menu: [Help]',
    category: 'header',
    visibilityKey: 'hdr:menu-help',
    controlType: 'none'
  },
  {
    id: 'h_menu_overflow',
    label: 'Menu: [Overflow]',
    category: 'header',
    visibilityKey: 'hdr:menu-overflow',
    controlType: 'none'
  },
  {
    id: 'h_color_mode',
    label: 'Appearance',
    description: 'Light, dark, or follow the system; the theme shows its light or dark face.',
    category: 'header',
    visibilityKey: 'hdr:color-mode',
    controlType: 'select',
    options: [
      { label: 'System', value: 'system' },
      { label: 'Light', value: 'light' },
      { label: 'Dark', value: 'dark' }
    ]
  },
  {
    id: 'h_theme',
    label: 'Color Theme',
    description: 'Switch overall color palette and Monaco editor theme.',
    category: 'header',
    prefPath: 'header.theme',
    visibilityKey: 'hdr:theme-select',
    controlType: 'select',
    options: [
      { label: 'Dracula', value: 'Dracula' },
      { label: 'GitHub', value: 'GitHub' },
      { label: 'Monokai', value: 'Monokai' },
      { label: 'Night Owl', value: 'Night Owl' },
      { label: 'Tukune', value: 'Tukune' }
    ]
  },
  {
    id: 'h_locale',
    label: 'UI Language',
    description: 'Switch application display language.',
    category: 'header',
    prefPath: 'header.locale',
    controlType: 'select',
    options: [
      { label: 'English (EN)', value: 'en' },
      { label: 'Japanese (JA)', value: 'ja' }
    ]
  },
  {
    id: 'h_zoom',
    label: 'UI Scaling (Zoom)',
    description: 'Adjust the overall scaling factor of the application UI.',
    category: 'header',
    prefPath: 'header.uiScale',
    visibilityKey: 'hdr:zoom-select',
    controlType: 'select',
    options: [
      { label: '100% (Default)', value: '1.0' },
      { label: '110%', value: '1.1' },
      { label: '125%', value: '1.25' },
      { label: '140%', value: '1.4' },
      { label: '150%', value: '1.5' }
    ]
  },
  {
    id: 'h_settings_btn',
    label: 'Settings Button (Gear)',
    description: 'Main settings modal trigger in header.',
    category: 'header',
    visibilityKey: 'hdr:settings-btn',
    controlType: 'none',
    isEssential: true
  },
  {
    id: 'h_minimize_btn',
    label: 'Header Minimize Button',
    description: 'Collapses the header to a thin strip, keeping only the gear and this toggle. The state is remembered.',
    category: 'header',
    visibilityKey: 'hdr:minimize',
    controlType: 'none'
  },

  // ── 2. EDITOR & GENERATIVE AI ──
  {
    id: 'ed_toolbar',
    label: 'Editor Action Toolbar',
    description: 'Main action toolbar above Monaco editor.',
    category: 'editor',
    visibilityKey: 'edt:toolbar',
    controlType: 'none'
  },
  {
    id: 'ed_font_family',
    label: 'Font Family',
    description: 'Select typeface for Monaco code and text rendering.',
    category: 'editor',
    prefPath: 'editor.fontFamily',
    visibilityKey: 'edt:font-family',
    controlType: 'select',
    options: [
      { label: 'Source Serif 4', value: "'Source Serif 4', 'Noto Serif JP', Georgia, serif" },
      { label: 'Source Sans 3 (Sans-serif)', value: "'Source Sans 3', 'Noto Sans JP', sans-serif" },
      { label: 'Source Code Pro (Monospace)', value: "'Source Code Pro', 'Cascadia Code', monospace" }
    ]
  },
  {
    id: 'ed_font_size',
    label: 'Font Size',
    description: 'Set editor typography size.',
    category: 'editor',
    prefPath: 'editor.fontSize',
    visibilityKey: 'edt:font-size',
    controlType: 'select',
    options: [
      { label: '14px', value: '14px' },
      { label: '16px', value: '16px' },
      { label: '18px', value: '18px' },
      { label: '20px', value: '20px' }
    ]
  },
  {
    id: 'ed_ai_toggle',
    label: 'Editor AI Toggle Button',
    description: 'Master switch for inline generative AI assistance on the editor toolbar.',
    category: 'editor',
    prefPath: 'editor.aiAssistEnabled',
    visibilityKey: 'edt:ai-toggle',
    controlType: 'toggle'
  },
  {
    id: 'ed_quick_settings',
    label: 'Editor Quick Settings Gear',
    description: 'Quick gear shortcut to jump to Editor & AI settings tab.',
    category: 'editor',
    visibilityKey: 'edt:quick-settings',
    controlType: 'none'
  },
  {
    id: 'ed_llm_provider',
    label: 'Generative LLM Engine',
    description: 'Target provider for text generation, rewriting, and summarization.',
    category: 'editor',
    prefPath: 'editor.llmProvider',
    controlType: 'select',
    options: [
      { label: 'Google Gemini (API)', value: 'gemini' },
      { label: 'Anthropic Claude (API)', value: 'claude' },
      { label: 'OpenAI (API)', value: 'openai' }
    ]
  },
  {
    id: 'ed_inference_scope',
    label: 'AI Inference Scope',
    description: 'Configure human-in-the-loop assistance level during drafting.',
    category: 'editor',
    prefPath: 'editor.inferenceScope',
    controlType: 'select',
    options: [
      { label: 'Suggestions Only (Human Writes Text)', value: 'suggestion_only' },
      { label: 'Suggestions + Lint Rule Assistance', value: 'lint_assist' },
      { label: 'Full Assistance (Suggestions + Lint + Drafting)', value: 'full_assist' }
    ]
  },

  {
    id: 'ed_save',
    label: 'Save Button',
    description: 'Save button with the autosave LED and its menu.',
    category: 'editor',
    visibilityKey: 'edt:save',
    hideNoticeKey: 'hide_notice_save',
    controlType: 'none'
  },
  {
    id: 'ed_bg_tone',
    label: 'Editor Background Tone',
    description: 'Quick selector for the editor background and text tone.',
    category: 'editor',
    visibilityKey: 'edt:bg-tone',
    controlType: 'none'
  },
  {
    id: 'ed_tab_bar',
    label: 'Document Tab Bar',
    description: 'Tabs of the open documents.',
    category: 'editor',
    visibilityKey: 'edt:tab-bar',
    hideNoticeKey: 'hide_notice_tab_bar',
    controlType: 'none'
  },
  {
    id: 'ed_status_bar',
    label: 'Editor Status Bar',
    description: 'Character count, line count, encoding, format and preview.',
    category: 'editor',
    visibilityKey: 'edt:status-bar',
    controlType: 'none'
  },
  {
    id: 'ed_document_format',
    label: 'Document Format Switch',
    description: 'Switches the current document between Markdown and Text.',
    category: 'editor',
    visibilityKey: 'edt:document-format',
    controlType: 'none'
  },
  {
    id: 'ed_markdown_preview',
    label: 'Markdown Preview Button',
    description: 'Shows or hides the Markdown preview.',
    category: 'editor',
    visibilityKey: 'edt:markdown-preview',
    controlType: 'none'
  },
  {
    id: 'ed_llm_dock',
    label: 'LLM Chat Dock',
    description: 'Chat and rewriting panel below the editor.',
    category: 'editor',
    visibilityKey: 'edt:llm-dock',
    controlType: 'none'
  },
  {
    id: 'ed_llm_key_config',
    label: 'LLM Chat: API Key Button',
    description: 'Opens the API key entry in the chat dock.',
    category: 'editor',
    visibilityKey: 'edt:llm-key-config',
    controlType: 'none'
  },
  {
    id: 'ed_llm_clear_chat',
    label: 'LLM Chat: Clear History Button',
    description: 'Clears the chat history.',
    category: 'editor',
    visibilityKey: 'edt:llm-clear-chat',
    controlType: 'none'
  },
  {
    id: 'ed_llm_collapse',
    label: 'LLM Chat: Collapse Button',
    description: 'Minimizes or expands the chat dock.',
    category: 'editor',
    visibilityKey: 'edt:llm-collapse',
    controlType: 'none'
  },
  {
    id: 'ed_llm_close',
    label: 'LLM Chat: Close Button',
    description: 'Closes the chat dock.',
    category: 'editor',
    visibilityKey: 'edt:llm-close',
    controlType: 'none'
  },

  // ── 3. KNOWLEDGE & VECTOR SIDEBAR ──
  {
    id: 'sb_sidebar',
    label: 'Knowledge Sidebar Panel',
    description: 'Collapsible right sidebar for semantic search and slot management.',
    category: 'sidebar',
    visibilityKey: 'sbr:sidebar',
    hideNoticeKey: 'hide_notice_sidebar',
    controlType: 'none'
  },
  {
    id: 'sb_score_filter',
    label: 'Minimum Similarity Score (%)',
    description: 'Score threshold to filter out low-similarity candidates.',
    category: 'sidebar',
    prefPath: 'sidebar.minSimilarityScore',
    visibilityKey: 'sbr:score-filter',
    controlType: 'number'
  },
  {
    id: 'sb_limit_select',
    label: 'Search Limit Selector',
    description: 'Dropdown to limit number of retrieved vector neighbors (5/10/20).',
    category: 'sidebar',
    prefPath: 'sidebar.maxSuggestionsLimit',
    visibilityKey: 'sbr:limit-select',
    controlType: 'select',
    options: [
      { label: '5 Results', value: 5 },
      { label: '10 Results', value: 10 },
      { label: '20 Results', value: 20 }
    ]
  },
  {
    id: 'sb_metadata_toggle',
    label: 'Show Full Metadata Checkbox',
    description: 'Checkbox to expand full key-value properties of knowledge entries.',
    category: 'sidebar',
    prefPath: 'sidebar.fullMetadata',
    visibilityKey: 'sbr:metadata-toggle',
    controlType: 'toggle'
  },
  {
    id: 'sb_metadata_fields',
    label: 'Metadata Field Checkboxes',
    description: 'One checkbox per metadata field of the results; ticked fields are shown on each card.',
    category: 'sidebar',
    visibilityKey: 'sbr:metadata-fields',
    controlType: 'none'
  },
  {
    id: 'sb_quick_settings',
    label: 'Knowledge Quick Settings Gear',
    description: 'Quick gear shortcut to jump to Knowledge & Vector settings tab.',
    category: 'sidebar',
    visibilityKey: 'sbr:quick-settings',
    controlType: 'none'
  },
  {
    id: 'sb_emb_source',
    label: 'Embedding Source',
    description: 'Vector representation engine (Local CPU / Cloud API).',
    category: 'sidebar',
    prefPath: 'sidebar.embeddingSource',
    controlType: 'select',
    options: [
      { label: 'Local (Transformers.js / 384-dim E5-Small)', value: 'local' },
      { label: 'Google Gemini Embedding', value: 'gemini' },
      { label: 'OpenAI Text Embedding', value: 'openai' }
    ]
  },
  {
    id: 'sb_trigger_mode',
    label: 'Suggestion Trigger Mode',
    description: 'Event trigger for vector similarity search popover.',
    category: 'sidebar',
    prefPath: 'sidebar.searchTrigger',
    controlType: 'select',
    options: [
      { label: 'Selection Auto Popover (Mouse Release)', value: 'selection' },
      { label: 'Right-Click Context Menu Only', value: 'contextmenu' },
      { label: 'Manual (Alt+S Shortcut Only)', value: 'manual' }
    ]
  },
  {
    id: 'sb_linter',
    label: 'Real-time Validation (Linter)',
    description: 'Enable Rust native Aho-Corasick static document linting.',
    category: 'sidebar',
    prefPath: 'sidebar.linterEnabled',
    controlType: 'toggle'
  },

  {
    id: 'sb_embedding_toggle',
    label: 'Embedding On/Off Button',
    description: 'Turns the embedding assistant on or off.',
    category: 'sidebar',
    visibilityKey: 'sbr:embedding-toggle',
    controlType: 'none'
  },
  {
    id: 'sb_import_dictionary',
    label: 'Import Dictionary Button',
    description: 'Loads a dictionary or knowledge file into a slot.',
    category: 'sidebar',
    visibilityKey: 'sbr:import-dictionary',
    controlType: 'none'
  },
  {
    id: 'sb_add_slot',
    label: 'Add Knowledge Slot Button',
    description: 'Adds an empty knowledge slot.',
    category: 'sidebar',
    visibilityKey: 'sbr:add-slot',
    controlType: 'none'
  },
  {
    id: 'sb_rail',
    label: 'Collapsed Sidebar Rail',
    description: 'Icon rail shown while the sidebar is collapsed.',
    category: 'sidebar',
    visibilityKey: 'sbr:rail',
    controlType: 'none'
  },

  {
    id: 'sb_guideline_card',
    label: 'Guideline Card',
    description: 'Active guideline preset and its templates.',
    category: 'sidebar',
    visibilityKey: 'sbr:guideline-card',
    hideNoticeKey: 'hide_notice_guideline_card',
    controlType: 'none'
  },
  {
    id: 'sb_knowledge_card',
    label: 'Knowledge Slots Card',
    description: 'Knowledge slots and their search results.',
    category: 'sidebar',
    visibilityKey: 'sbr:knowledge-card',
    hideNoticeKey: 'hide_notice_knowledge_card',
    controlType: 'none'
  },
  {
    id: 'sb_editor_options_card',
    label: 'Editor Options Card',
    description: 'Monaco editor options with live preview in the main editor.',
    category: 'sidebar',
    visibilityKey: 'sbr:editor-options-card',
    controlType: 'none'
  },

  // ── 4. SYSTEM & BOTTOM BAR ──
  {
    id: 'sys_bottom_bar',
    label: 'Bottom Status & Log Bar',
    description: 'Bottom bar containing system status and logs.',
    category: 'system',
    visibilityKey: 'sys:bottom-bar',
    hideNoticeKey: 'hide_notice_bottom_bar',
    controlType: 'none'
  },
  {
    id: 'sys_status_bar',
    label: 'Editor Status Information (chars/lines/encoding)',
    description: 'Document metrics displayed in status bar.',
    category: 'system',
    visibilityKey: 'sys:status-meta',
    controlType: 'none'
  },
  {
    id: 'sys_pipeline_meter',
    label: '7-Stage Pipeline Status LED Meter',
    description: 'Diagnostics indicator for Rust, HNSW, Config, Theme, Locale, Monaco, AI.',
    category: 'system',
    visibilityKey: 'sys:pipeline-meter',
    controlType: 'none'
  },
  {
    id: 'sys_log_console',
    label: 'System Log Console Panel',
    description: 'Slide-up terminal log console for execution diagnostics.',
    category: 'system',
    visibilityKey: 'sys:log-console',
    controlType: 'none'
  },
  {
    id: 'sys_quick_settings',
    label: 'System Quick Settings Gear',
    description: 'Quick gear shortcut to jump to System & Bottom Bar settings tab.',
    category: 'system',
    visibilityKey: 'sys:quick-settings',
    controlType: 'none'
  },
  {
    id: 'sys_collapse_logs',
    label: 'Start with Logs Closed',
    description: 'Automatically collapse bottom log console upon startup.',
    category: 'system',
    prefPath: 'system.collapseLogsOnStartup',
    controlType: 'toggle'
  },
  {
    id: 'sys_log_clear',
    label: 'Log Panel: Clear Button',
    description: 'Clears the log.',
    category: 'system',
    visibilityKey: 'sys:log-clear',
    controlType: 'none'
  },
  {
    id: 'sys_log_copy',
    label: 'Log Panel: Copy Button',
    description: 'Copies the log to the clipboard.',
    category: 'system',
    visibilityKey: 'sys:log-copy',
    controlType: 'none'
  },
  {
    id: 'sys_log_download',
    label: 'Log Panel: Save Button',
    description: 'Saves the log to a file.',
    category: 'system',
    visibilityKey: 'sys:log-download',
    controlType: 'none'
  },
  {
    id: 'sys_update_status',
    label: 'Update Indicator',
    description: 'Shows when an update is available.',
    category: 'system',
    visibilityKey: 'sys:update-status',
    controlType: 'none'
  },
  {
    id: 'sys_save_status',
    label: 'Save Status Indicator',
    description: 'Shows the result of the last save.',
    category: 'system',
    visibilityKey: 'sys:save-status',
    controlType: 'none'
  }
];
