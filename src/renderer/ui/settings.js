import { isLlmConfigured, isEmbedConfigured, loadSettingsFromBackend } from './settings/settingsState.js';
import { initSettings, getTheme, getFontFamily, getFontSize } from './settings/settingsFacade.js';

// Currently routing through Facade for backward compatibility
export { isLlmConfigured, isEmbedConfigured, loadSettingsFromBackend, initSettings, getTheme, getFontFamily, getFontSize };
