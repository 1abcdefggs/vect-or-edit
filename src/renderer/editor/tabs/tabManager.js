/**
 * Facade for the Tab Management Subsystem
 */
export {
  tabs,
  activeTabId,
  getActiveTab,
  createNewTab,
  createBlankTab,
  switchTab,
  closeTab,
  markActiveTabSaved
} from './tabState.js';

export {
  renderTabs,
  triggerRpgSavedExpFloat
} from './tabRenderer.js';

export {
  extractSelectionToNewTab,
  duplicateCurrentTab
} from './tabActions.js';
