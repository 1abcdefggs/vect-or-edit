import { t } from './core/i18n';
import { icons } from './core/icons';
import { renderTabSample } from './editor/tabs/tabRenderer.js';
import { initStartupFlow, completeStartup, hideStartupLoader } from './core/startupManager';
import { loadLocales } from './core/i18n';
import { initSettings, loadSettingsFromBackend } from './ui/settings.js';
import { syncSettingsToBackend } from './ui/settings/settingsState.js';
import { migratePlaintextApiKeys, refreshApiKeyStatus } from './core/apiKeyStore.js';
import { initQuickDictionary } from './search/dictionary.js';
import { initEditor, updateEditorOptions, initMemoryMonitor, applyEditorCanvasTone, initAutoSaveControls } from './editor/editorManager.js';
import { setLedStatus, led, initAllLedTooltips } from './core/statusManager';
import { initVectorSearch } from './search/vectorSearch.js';
import { initUpdateChecker } from './ui/updateChecker.js';
import { initSidebarResizer } from './ui/layout/sidebarResizer.js';
import { migrateLlmProvider } from './core/llmProviderMigration.js';
import { initPanelResizers } from './ui/layout/panelResizer.js';
import { initEditorOptionsMode } from './ui/layout/editorOptionsMode.js';
import { initLampNavigation } from './ui/layout/lampNavigation.js';
import { initTopBarRenderer, bindTopLevelUIEvents } from './ui/layout/topBarRenderer.js';
import { initAiControls } from './ui/ai/aiToolbarController.js';
import { initChatPlacement } from './ui/ai/chatPlacement.js';
import { initSystemConsole } from './ui/console/systemConsoleManager.js';
import { initJumpContextMenu } from './ui/settings/jumpContextMenu.js';
import { bindAppActionEvents } from './ui/actions/appActionEvents.js';
import { initZoomControls } from './ui/zoomController.js';
import { injectLazyUIComponents } from './core/uiLoader';
import { initMenuBar } from './ui/layout/menuBarController';
import { renderMenuDropdowns } from './ui/layout/menuRenderer';
import { renderStaticSettingsText } from './ui/settings/settingsStaticMarkup';
import { initCardCollapse } from './ui/settings/cardCollapse.js';
import { renderToggleSwitches } from './ui/components/toggleSwitchMarkup';
import { enhanceNumberSteppers } from './ui/components/numberStepper';
import { settingsStore } from './core/settingsStore';
import { enhanceSettingsModalVisibilityControls } from './ui/settings/settingsModalRenderer';
import { initInstantTooltips } from './ui/tooltips/instantTooltip';
import { applyTooltipWidth } from './ui/tooltips/tooltipWidth.js';
import { applyScrollbarStyle } from './ui/appearance/scrollbarStyle.js';
import { initSelectMenus } from './ui/components/selectMenu';
import { initMarkdownPreview } from './editor/ui/markdownPreview.js';
import { initDocumentFormatControl } from './editor/ui/documentFormatControl.js';
import { initDocumentLanguageControl } from './editor/ui/documentLanguageControl.js';
import { initMonacoOptionsPanel } from './editor/options/monacoOptionsPanel.js';
import { initHeaderMinimize } from './ui/layout/headerMinimize.js';
import { showToast } from './ui/notifications/toastManager';

export { setLedStatus };

window.__icons__ = icons;

const STARTUP_LOADER_MAX_MS = 15000;

document.addEventListener('DOMContentLoaded', async () => {
  // 0. Inject lazy HTML components (Modals, System Logs)
  injectLazyUIComponents();

  // 0.1. Restore the Dual-Sync settings (.settings.json) first, so the saved language and setup state apply from the first paint
  await loadSettingsFromBackend();

  // 0.15. API keys: move plain-text keys from older versions into the encrypted store, then drop them from .settings.json
  const keyMigration = await migratePlaintextApiKeys();
  if (keyMigration.removed) await syncSettingsToBackend();
  await refreshApiKeyStatus();

  // 0.2. Immediately apply Locale (Ensures 3. LOCALE is ready and UI text is localized instantly)
  // Settings text placeholders first: loadLocales applies the locale to them as well
  renderStaticSettingsText();
  renderTabSample();
  renderToggleSwitches();
  await loadLocales();
  // Every settings card heading gets its show/hide button; the cards start open
  initCardCollapse();
  // Shown after the locale is loaded, so the message is in the user's language
  if (keyMigration.failedProviders.length > 0) showToast(t('api_key_migration_failed'), 'warning');
  enhanceNumberSteppers();

  // 0.5. Initialize LED tooltips consistently
  initAllLedTooltips();
  initInstantTooltips();
  applyTooltipWidth();
  applyScrollbarStyle();
  initSelectMenus();

  // 0.6. First-run setup opens now and stays usable while the editor loads behind it
  // A failure here must not stop the editor from starting (the startup loader is dismissed by the editor init)
  try {
    initStartupFlow();
  } catch (err) {
    console.error('[Startup] First-run setup failed to open:', err);
  }

  // 0.7. Initialize master settings store & UI visibility
  migrateLlmProvider();
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
  renderMenuDropdowns();
  initMenuBar();
  initSidebarResizer();
  initPanelResizers();
  initEditorOptionsMode();
  initLampNavigation();

  // 2. Setup Engine & Knowledge Base IPC Listeners
  if (window.engineAPI?.onEngineStatus) {
    window.engineAPI.onEngineStatus((status) => {
      if (status.binReady) {
        setLedStatus('bin', true, led('led_bin_bound'));
      } else {
        setLedStatus('bin', 'error', led('led_bin_unavailable'));
      }

      if (status.kbReady) {
        setLedStatus('kb', true, status.kbSlotsOut ? led('led_kb_indexed_out', { count: status.count.toLocaleString(), used: status.kbSlotsUsed ?? 0, out: status.kbSlotsOut }) : led('led_kb_indexed', { count: status.count.toLocaleString() }));
      } else if (status.kbFailed) {
        setLedStatus('kb', 'error', led('led_kb_failed'));
      } else {
        setLedStatus('kb', 'standby', led('led_kb_unloaded'));
      }
    });
  }

  if (window.engineAPI?.getEngineStatus) {
    window.engineAPI.getEngineStatus().then((status) => {
      if (status?.binReady) {
        setLedStatus('bin', true, led('led_bin_bound'));
      } else {
        setLedStatus('bin', 'error', led('led_bin_unavailable'));
      }

      if (status?.kbReady) {
        setLedStatus('kb', true, status.kbSlotsOut ? led('led_kb_indexed_out', { count: status.count.toLocaleString(), used: status.kbSlotsUsed ?? 0, out: status.kbSlotsOut }) : led('led_kb_indexed', { count: status.count.toLocaleString() }));
      } else if (status?.kbFailed) {
        setLedStatus('kb', 'error', led('led_kb_failed'));
      } else {
        setLedStatus('kb', 'standby', led('led_kb_unloaded'));
      }
    }).catch(() => {
      setLedStatus('bin', 'error', led('led_bin_ipc_failed'));
    });
  }

  // 3. Launch Editor & Core Modules in Parallel
  const editorPromise = initEditor();
  const initModulesPromise = (async () => {
    initSettings(updateEditorOptions);
    initHeaderMinimize();
  })();

  Promise.all([editorPromise, initModulesPromise])
    .then(() => {
      completeStartup();
    })
    .catch((err) => {
      console.error('[Startup] Init failed:', err);
      // The loader never outlives a failed startup
      setTimeout(hideStartupLoader, 500);
    });

  // Last resort if init never settles
  setTimeout(hideStartupLoader, STARTUP_LOADER_MAX_MS);

  // 4. Background Services & Controllers
  initMarkdownPreview();
  initDocumentFormatControl();
  initDocumentLanguageControl();
  initQuickDictionary();
  initVectorSearch();
  initAiControls();
  initChatPlacement();
  initZoomControls();
  initSystemConsole();
  initJumpContextMenu();
  bindAppActionEvents();
  initMonacoOptionsPanel();
  initAutoSaveControls();

  // 5. Finalize UI States
  await Promise.all([editorPromise, initModulesPromise]);
  initMemoryMonitor();
  applyEditorCanvasTone();
  initUpdateChecker();
});
