import { icons } from './core/icons';
import { initStartupFlow, hideStartupLoader } from './core/startupManager';
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
import { initMenuBar } from './ui/layout/menuBarController';
import { settingsStore } from './core/settingsStore';
import { enhanceSettingsModalVisibilityControls } from './ui/settings/settingsModalRenderer';
import { initInstantTooltips } from './ui/tooltips/instantTooltip';
import { initSelectMenus } from './ui/components/selectMenu';

export { setLedStatus };

window.__icons__ = icons;

const STARTUP_LOADER_MAX_MS = 15000;

document.addEventListener('DOMContentLoaded', async () => {
  // 0. Inject lazy HTML components (Modals, System Logs)
  injectLazyUIComponents();
  
  // 0.2. Immediately apply Locale (Ensures 3. LOCALE is ready and UI text is localized instantly)
  await loadLocales();

  // 0.5. Initialize LED tooltips consistently
  initAllLedTooltips();
  initInstantTooltips();
  initSelectMenus();

  // 0.7. Initialize master settings store & UI visibility
  await settingsStore.syncWithBackend();
  settingsStore.applyAllDomVisibility();
  enhanceSettingsModalVisibilityControls();

  // 0.8. Global keyboard shortcuts (Ctrl+, rescue to Settings)
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === ',') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('app:openSettings', { detail: { tab: 'tabAppearance' } }));
    }
  });

  window.addEventListener('app:resetUIVisibility', () => {
    settingsStore.resetVisibility();
  });

  // 1. Initialize UI Layout & Elements
  initTopBarRenderer();
  bindTopLevelUIEvents();
  initMenuBar();
  initSidebarResizer();

  // 2. Setup Engine & Knowledge Base IPC Listeners
  if (window.engineAPI?.onEngineStatus) {
    window.engineAPI.onEngineStatus((status) => {
      if (status.binReady) {
        setLedStatus('bin', true, '5. RUST: Bound via N-API');
      } else {
        setLedStatus('bin', 'error', '5. RUST: Engine Not Available');
      }

      if (status.kbReady) {
        setLedStatus('kb', true, `7. HNSW: Indexed (${status.count.toLocaleString()} items)`);
      } else {
        setLedStatus('kb', 'standby', '7. HNSW: Unloaded');
      }
    });
  }

  if (window.engineAPI?.getEngineStatus) {
    window.engineAPI.getEngineStatus().then((status) => {
      if (status?.binReady) {
        setLedStatus('bin', true, '5. RUST: Bound via N-API');
      } else {
        setLedStatus('bin', 'error', '5. RUST: Engine Not Available');
      }

      if (status?.kbReady) {
        setLedStatus('kb', true, `7. HNSW: Indexed (${status.count.toLocaleString()} items)`);
      } else {
        setLedStatus('kb', 'standby', '7. HNSW: Unloaded');
      }
    }).catch(() => {
      setLedStatus('bin', 'error', '5. RUST: IPC Connection Failed');
    });
  }

  // 3. Launch Editor & Core Modules in Parallel
  const editorPromise = initEditor();
  const initModulesPromise = (async () => {
    await loadSettingsFromBackend();
    await loadLocales();
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
      // Fallback guarantee: the loader never outlives startup, even when the AI setup modal or an init error blocks the normal dismissal
      setTimeout(hideStartupLoader, 500);
    });

  // Last resort if init never settles
  setTimeout(hideStartupLoader, STARTUP_LOADER_MAX_MS);

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
