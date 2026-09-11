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
      llmModel: 'gemini-1.5-flash',
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
      collapseLogsOnStartup: true
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
    'hdr:master-ai': true,
    'hdr:theme-select': true,
    'hdr:locale-toggle': true,
    'hdr:zoom-select': true,
    'hdr:settings-btn': true,
    'hdr:console-toggle': true,
    'edt:toolbar': true,
    'edt:font-family': true,
    'edt:font-size': true,
    'edt:diff-mode': true,
    'edt:ai-toggle': true,
    'edt:quick-settings': true,
    'sbr:sidebar': true,
    'sbr:query-input': true,
    'sbr:score-filter': true,
    'sbr:limit-select': true,
    'sbr:metadata-toggle': true,
    'sbr:quick-settings': true,
    'sys:bottom-bar': true,
    'sys:status-meta': true,
    'sys:pipeline-meter': true,
    'sys:log-console': true,
    'sys:quick-settings': true
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
    id: 'h_master_ai',
    label: 'Master AI Status Badge',
    description: 'Header action badge indicating AI engine availability.',
    category: 'header',
    visibilityKey: 'hdr:master-ai',
    controlType: 'none'
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
      { label: 'GitHub Dark', value: 'GitHub Dark' },
      { label: 'GitHub Light', value: 'GitHub Light' },
      { label: 'Monokai', value: 'Monokai' },
      { label: 'Night Owl', value: 'Night Owl' }
    ]
  },
  {
    id: 'h_locale',
    label: 'UI Language',
    description: 'Switch application display language.',
    category: 'header',
    prefPath: 'header.locale',
    visibilityKey: 'hdr:locale-toggle',
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
    id: 'h_console_toggle',
    label: 'Log Console Toggle Button',
    description: 'Header action button to open/close system log console.',
    category: 'header',
    visibilityKey: 'hdr:console-toggle',
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
      { label: 'Source Serif 4 (Serif)', value: "'Source Serif 4', 'Noto Serif JP', Georgia, serif" },
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
    id: 'ed_diff_mode',
    label: 'Diff Comparison Button',
    description: 'Toolbar button to switch into original/modified diff editor.',
    category: 'editor',
    visibilityKey: 'edt:diff-mode',
    controlType: 'none'
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

  // ── 3. KNOWLEDGE & VECTOR SIDEBAR ──
  {
    id: 'sb_sidebar',
    label: 'Knowledge Sidebar Panel',
    description: 'Collapsible right sidebar for semantic search and slot management.',
    category: 'sidebar',
    visibilityKey: 'sbr:sidebar',
    controlType: 'none'
  },
  {
    id: 'sb_query_input',
    label: 'Vector Search Query Box',
    description: 'Search box for manual semantic similarity queries.',
    category: 'sidebar',
    visibilityKey: 'sbr:query-input',
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

  // ── 4. SYSTEM & BOTTOM BAR ──
  {
    id: 'sys_bottom_bar',
    label: 'Bottom Status & Log Bar',
    description: 'Bottom bar containing system status and logs.',
    category: 'system',
    visibilityKey: 'sys:bottom-bar',
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
  }
];
