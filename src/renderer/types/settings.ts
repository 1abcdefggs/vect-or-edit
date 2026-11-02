export interface HeaderPreferences {
  theme: string;
  locale: 'en' | 'ja';
  uiScale: string;
  windowWidth: number;
  windowHeight: number;
}

export interface EditorPreferences {
  fontFamily: string;
  fontSize: string;
  lineWrapping: 'on' | 'off';
  minimap: boolean;
  aiAssistEnabled: boolean;
  llmProvider: 'gemini' | 'openai' | 'claude';
  llmModel: string;
  inferenceScope: 'suggestion_only' | 'lint_assist' | 'full_assist';
}

export interface SidebarPreferences {
  embeddingSource: 'local' | 'gemini' | 'claude' | 'openai';
  minSimilarityScore: number;
  maxSuggestionsLimit: number;
  searchTrigger: 'selection' | 'contextmenu' | 'manual';
  contextMenuLayout: 'pattern_a' | 'pattern_b';
  fullMetadata: boolean;
  linterEnabled: boolean;
}

export interface SystemPreferences {
  collapseLogsOnStartup: boolean;
  logTimeFormat: 'h24' | 'h12' | 'os' | 'iso';
  logTimeZone: 'local' | 'utc';
}

export interface AppPreferences {
  header: HeaderPreferences;
  editor: EditorPreferences;
  sidebar: SidebarPreferences;
  system: SystemPreferences;
}

export type HeaderUiKey =
  | 'hdr:logo'
  | 'hdr:menu-bar'
  | 'hdr:menu-file'
  | 'hdr:menu-edit'
  | 'hdr:menu-view'
  | 'hdr:menu-window'
  | 'hdr:menu-help'
  | 'hdr:menu-overflow'
  | 'hdr:theme-select'
  | 'hdr:color-mode'
  | 'hdr:zoom-select'
  | 'hdr:settings-btn'
  | 'hdr:minimize';

export type EditorUiKey =
  | 'edt:toolbar'
  | 'edt:font-family'
  | 'edt:font-size'
  | 'edt:ai-toggle'
  | 'edt:quick-settings'
  | 'edt:save'
  | 'edt:bg-tone'
  | 'edt:tab-bar'
  | 'edt:status-bar'
  | 'edt:document-format'
  | 'edt:markdown-preview'
  | 'edt:llm-dock'
  | 'edt:llm-key-config'
  | 'edt:llm-clear-chat'
  | 'edt:llm-collapse'
  | 'edt:llm-close';

export type SidebarUiKey =
  | 'sbr:sidebar'
  | 'sbr:score-filter'
  | 'sbr:limit-select'
  | 'sbr:metadata-toggle'
  | 'sbr:metadata-fields'
  | 'sbr:quick-settings'
  | 'sbr:embedding-toggle'
  | 'sbr:import-dictionary'
  | 'sbr:add-slot'
  | 'sbr:rail'
  | 'sbr:guideline-card'
  | 'sbr:knowledge-card'
  | 'sbr:editor-options-card';

export type SystemUiKey =
  | 'sys:bottom-bar'
  | 'sys:status-meta'
  | 'sys:pipeline-meter'
  | 'sys:log-console'
  | 'sys:quick-settings'
  | 'sys:log-clear'
  | 'sys:log-copy'
  | 'sys:log-download'
  | 'sys:update-status'
  | 'sys:save-status';

export type UiKey = HeaderUiKey | EditorUiKey | SidebarUiKey | SystemUiKey;

export type AppVisibility = Record<UiKey, boolean>;

export interface AppSettings {
  version: string;
  preferences: AppPreferences;
  visibility: AppVisibility;
}

export interface SettingOption {
  label: string;
  value: any;
  i18nKey?: string;
}

export interface SettingItemDef {
  id: string;
  label: string;
  description?: string;
  i18nLabel?: string;
  i18nDesc?: string;
  category: 'header' | 'editor' | 'sidebar' | 'system';
  /** Locale key of a warning shown when the part is hidden: what stops being available. */
  hideNoticeKey?: string;
  prefPath?: string;                    // e.g. "editor.fontFamily"
  visibilityKey?: UiKey;                // Target key for eye icon toggle
  isEssential?: boolean;                // true = locked (🔒) cannot be hidden
  controlType: 'select' | 'toggle' | 'number' | 'text' | 'action' | 'none';
  options?: SettingOption[];
}
