import { icons } from './core/icons';
import { initStartupFlow } from './core/startupManager';
import { loadLocales } from './core/i18n';
import { initSettings, loadSettingsFromBackend } from './ui/settings.js';
import { initQuickDictionary } from './search/dictionary.js';
import { initEditor, updateEditorOptions, initMemoryMonitor, applyEditorCanvasTone } from './editor/editorManager.js';
import { setLedStatus, initAllLedTooltips } from './core/statusManager';
import { initVectorSearch } from './search/vectorSearch.js';
import { initUpdateChecker } from './ui/updateChecker.js';
import { initSidebarResizer } from './ui/layout/sidebarResizer.js';
import { initTopBarRenderer, bindTopLevelUIEvents } from './ui/layout/topBarRenderer.js';
import { initAiControls } from './ui/ai/aiToolbarController.js';
import { initSystemConsole } from './ui/console/systemConsoleManager.js';
import { bindAppActionEvents } from './ui/actions/appActionEvents.js';
import { initZoomControls } from './ui/zoomController.js';
import { injectLazyUIComponents } from './core/uiLoader';

export { setLedStatus };

window.__icons__ = icons;

document.addEventListener('DOMContentLoaded', async () => {
  // 0. Inject lazy HTML components (Modals, System Logs)
  injectLazyUIComponents();
  
  // 0.5. Initialize LED tooltips consistently
  initAllLedTooltips();

  // 1. Initialize UI Layout & Elements
  initTopBarRenderer();
  bindTopLevelUIEvents();
  initSidebarResizer();

  // 2. Setup Engine & Knowledge Base IPC Listeners
  if (window.engineAPI?.onEngineStatus) {
    window.engineAPI.onEngineStatus((status) => {
      if (status.binReady) setLedStatus('bin', true, '5. RUST: Bound via N-API');
      if (status.kbReady) setLedStatus('kb', true, `7. HNSW: Indexed (${status.count.toLocaleString()} items)`);
      if (status.profileName) {
        const activeProfileEl = document.getElementById('activeProfileName');
        if (activeProfileEl) activeProfileEl.textContent = status.profileName;
      }
    });
  }

  if (window.engineAPI?.getEngineStatus) {
    window.engineAPI.getEngineStatus().then((status) => {
      if (status?.binReady) setLedStatus('bin', true, '5. RUST: Bound via N-API');
      if (status?.kbReady) setLedStatus('kb', true, `7. HNSW: Indexed (${status.count.toLocaleString()} items)`);
      if (status?.profileName) {
        const activeProfileEl = document.getElementById('activeProfileName');
        if (activeProfileEl) activeProfileEl.textContent = status.profileName;
      }
    }).catch(() => {});
  }

  // 3. Launch Editor & Core Modules in Parallel
  const editorPromise = initEditor();
  const initModulesPromise = (async () => {
    await loadLocales();
    await loadSettingsFromBackend();
    initSettings(updateEditorOptions);
  })();

  Promise.all([editorPromise, initModulesPromise])
    .then(() => {
      initStartupFlow();
    })
    .catch((err) => {
      console.error('[Startup] Init failed:', err);
    })
    .finally(() => {
      // Fallback guarantee: dismiss loader after 500ms regardless
      setTimeout(() => {
        const loader = document.getElementById('appStartupLoader');
        if (loader) loader.remove();
      }, 500);
    });

  // 4. Background Services & Controllers
  initQuickDictionary();
  initVectorSearch();
  initAiControls();
  initZoomControls();
  initSystemConsole();
  bindAppActionEvents();

  // 5. Finalize UI States
  await Promise.all([editorPromise, initModulesPromise]);
  initMemoryMonitor();
  applyEditorCanvasTone();
  initUpdateChecker();
});
