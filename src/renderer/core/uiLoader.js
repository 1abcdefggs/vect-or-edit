import appHeaderHtml from '../components/appHeader.html?raw';
import mainEditorHtml from '../components/mainEditor.html?raw';
import suggestionSidebarHtml from '../components/suggestionSidebar.html?raw';
import nativeBottomBarHtml from '../components/nativeBottomBar.html?raw';

import systemLogPanelHtml from '../components/systemLogPanel.html?raw';
import settingsModalHtml from '../components/settingsModal.html?raw';
import workspaceSetupModalHtml from '../components/workspaceSetupModal.html?raw';
import updateModalHtml from '../components/updateModal.html?raw';
import aiSetupModalHtml from '../components/aiSetupModal.html?raw';

/**
 * Dynamically injects heavy HTML components into the DOM after the initial render.
 * This significantly improves the initial startup speed by reducing parsing and rendering time.
 */
export function injectLazyUIComponents() {
  const mainAppContainer = document.querySelector('.app-container');
  const workspaceContainer = document.querySelector('.workspace');

  if (mainAppContainer && workspaceContainer) {
    // Inject Layout structural parts
    mainAppContainer.insertAdjacentHTML('afterbegin', appHeaderHtml);
    workspaceContainer.insertAdjacentHTML('beforeend', mainEditorHtml);
    workspaceContainer.insertAdjacentHTML('beforeend', suggestionSidebarHtml);
    mainAppContainer.insertAdjacentHTML('beforeend', nativeBottomBarHtml);

    // Inject components that should reside inside the app-container
    mainAppContainer.insertAdjacentHTML('beforeend', systemLogPanelHtml);
    mainAppContainer.insertAdjacentHTML('beforeend', settingsModalHtml);
  } else {
    console.warn('uiLoader: Layout containers not found, appending to body');
    document.body.insertAdjacentHTML('beforeend', systemLogPanelHtml);
    document.body.insertAdjacentHTML('beforeend', settingsModalHtml);
  }

  // Inject modals that should reside at the body level
  document.body.insertAdjacentHTML('beforeend', workspaceSetupModalHtml);
  document.body.insertAdjacentHTML('beforeend', updateModalHtml);
  document.body.insertAdjacentHTML('beforeend', aiSetupModalHtml);

  // Dispatch an event so that other modules (like statusManager or uiManager)
  // know the DOM nodes are now available for binding.
  window.dispatchEvent(new Event('uiComponentsLoaded'));
}
