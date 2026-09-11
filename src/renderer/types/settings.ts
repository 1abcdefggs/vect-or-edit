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
  | 'hdr:master-ai'
  | 'hdr:theme-select'
  | 'hdr:locale-toggle'
  | 'hdr:zoom-select'
  | 'hdr:settings-btn'
  | 'hdr:console-toggle';

export type EditorUiKey =
  | 'edt:toolbar'
  | 'edt:font-family'
  | 'edt:font-size'
  | 'edt:diff-mode'
  | 'edt:ai-toggle'
  | 'edt:quick-settings';

export type SidebarUiKey =
  | 'sbr:sidebar'
  | 'sbr:query-input'
  | 'sbr:score-filter'
  | 'sbr:limit-select'
  | 'sbr:metadata-toggle'
  | 'sbr:quick-settings';

export type SystemUiKey =
  | 'sys:bottom-bar'
  | 'sys:status-meta'
  | 'sys:pipeline-meter'
  | 'sys:log-console'
  | 'sys:quick-settings';

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
  prefPath?: string;                    // e.g. "editor.fontFamily"
  visibilityKey?: UiKey;                // Target key for eye icon toggle
  isEssential?: boolean;                // true = locked (🔒) cannot be hidden
  controlType: 'select' | 'toggle' | 'number' | 'text' | 'action' | 'none';
  options?: SettingOption[];
}
