import { isAiModelConfigured } from './settings/settingsState.js';
import { initSettings, getTheme, getFontFamily, getFontSize } from './settings/settingsFacade.js';

// Currently routing through Facade for backward compatibility
export { isAiModelConfigured, initSettings, getTheme, getFontFamily, getFontSize };
