import { isAiModelConfigured, loadSettingsFromBackend } from './settings/settingsState.js';
import { initSettings, getTheme, getFontFamily, getFontSize } from './settings/settingsFacade.js';

// Currently routing through Facade for backward compatibility
export { isAiModelConfigured, loadSettingsFromBackend, initSettings, getTheme, getFontFamily, getFontSize };
