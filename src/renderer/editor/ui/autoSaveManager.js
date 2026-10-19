/**
 * AutoSave Manager - Plan A (Clear SAVE vs AUTO)
 */
import { STORAGE_KEYS, TIMINGS } from '../../core/constants.js';
import { i18n, t } from '../../core/i18n.js';
import { editorEvents } from '../core/editorEvents.js';
import { getActiveTab } from '../tabs/tabState.js';
import { markSavedAsUtf8 } from './statusBarManager.js';
import { commitTabToFile } from '../io/tabCommit.js';
import { showToast } from '../../ui/notifications/toastManager.js';

const adhap = {
  BASE_DELAY_MS: TIMINGS.AUTO_SAVE_BASE_MS || 1500,
  STATUS_NOTIFICATION_MS: 1500
};

const autoSaveTimers = new Map();
const pendingTargets = new Set();
const declinedTargets = new Set();
/** Tabs whose latest write failed. The failure toast shows once per streak, not on every keystroke. */
const failingTabs = new Set();
const LOCATION_CONFIRMED_KEY = 'vectoreditor_autosave_location_confirmed';
let domCache = {};

function getDomElements() {
  if (!domCache.chkToggle) domCache.chkToggle = document.getElementById('chkAutoSaveToggle');
  if (!domCache.labelEl) domCache.labelEl = document.getElementById('btnSaveLabel');
  if (!domCache.saveInd) domCache.saveInd = document.getElementById('statusSaveIndicator');
  if (!domCache.ledDot) domCache.ledDot = document.getElementById('autoSaveLedDot');
  return domCache;
}

let savedIndicatorTimer = null;

/** Flashes "Saved" in the status bar; repeated autosaves restart the fade instead of cutting it short. */
function showSavedIndicator() {
  const { saveInd } = getDomElements();
  if (!saveInd) return;
  saveInd.textContent = t('status_saved');
  saveInd.style.opacity = '1';
  clearTimeout(savedIndicatorTimer);
  savedIndicatorTimer = setTimeout(() => {
    saveInd.style.opacity = '0';
  }, adhap.STATUS_NOTIFICATION_MS);
}

export function updateAutoSaveUI() {
  const isAutoSaveEnabled = localStorage.getItem(STORAGE_KEYS.AUTO_SAVE) !== 'false';
  const { chkToggle, ledDot, labelEl } = getDomElements();
  const activeTab = typeof getActiveTab === 'function' ? getActiveTab() : null;
  const hasFilePath = !!(activeTab && activeTab.filePath);

  if (chkToggle) chkToggle.checked = isAutoSaveEnabled;

  if (ledDot) {
    if (isAutoSaveEnabled) {
      if (hasFilePath) {
        ledDot.className = 'status-led-dot status-ready';
        ledDot.style.background = '#10b981';
        ledDot.style.boxShadow = '0 0 6px rgba(16, 185, 129, 0.7)';
        ledDot.title = `AutoSave: ON (To: ${activeTab.filePath})`;
        if (labelEl) labelEl.textContent = 'AUTO'
      } else {
        ledDot.className = 'status-led-dot';
        ledDot.style.background = '#f59e0b';
        ledDot.style.boxShadow = '0 0 6px rgba(245, 158, 11, 0.6)';
        ledDot.title = 'Unsaved: Press Ctrl+S to choose location for AutoSave';
        if (labelEl) labelEl.textContent = 'SAVE';
      }
    } else {
      ledDot.className = 'status-led-dot';
      ledDot.style.background = '#64748b';
      ledDot.style.boxShadow = 'none';
      ledDot.title = 'AutoSave: OFF (Click to enable)';
      if (labelEl) labelEl.textContent = 'SAVE';
    }
  }
}

export function initAutoSaveControls() {
  const { chkToggle, ledDot } = getDomElements();
  if (chkToggle) {
    chkToggle.addEventListener('change', (e) => {
      localStorage.setItem(STORAGE_KEYS.AUTO_SAVE, String(e.target.checked));
      if (e.target.checked) {
        declinedTargets.clear();
        ensureAutoSaveTarget(getActiveTab());
      }
      updateAutoSaveUI();
    });
  }
  if (ledDot) {
    ledDot.addEventListener('click', (e) => {
      e.stopPropagation();
      const current = localStorage.getItem(STORAGE_KEYS.AUTO_SAVE) !== 'false';
      localStorage.setItem(STORAGE_KEYS.AUTO_SAVE, String(!current));
      if (!current) {
        declinedTargets.clear();
        ensureAutoSaveTarget(getActiveTab());
      }
      updateAutoSaveUI();
    });
  }
  updateAutoSaveUI();
  editorEvents.on('onTabRenderNeeded', () => updateAutoSaveUI());
}

async function executeSave(tab) {
  if (!tab || !tab.model) return;
  try {
    localStorage.setItem(`autosave_${tab.id}`, JSON.stringify({
      title: tab.title,
      content: tab.model.getValue(),
      filePath: tab.filePath || null,
      timestamp: Date.now()
    }));
  } catch (err) {
    console.warn('[AutoSave] Draft write failed:', err);
  }

  // A draft is not a save. Without a file path the tab stays dirty until the user picks a location.
  if (!tab.filePath) {
    editorEvents.emit('onTabRenderNeeded');
    return;
  }

  const result = await commitTabToFile(tab);
  editorEvents.emit('onTabRenderNeeded');

  if (result.ok) {
    failingTabs.delete(tab.id);
    markSavedAsUtf8();
    showSavedIndicator();
  } else if (!result.canceled) {
    reportAutoSaveFailure(tab, result.error);
  }
}

function reportAutoSaveFailure(tab, error) {
  console.warn('[AutoSave] Save failed:', error);
  if (failingTabs.has(tab.id)) return;
  failingTabs.add(tab.id);
  showToast(t('save_failed'), 'error');
}

/**
 * Gives an unsaved tab a file path so AUTO can write to disk.
 * Order: first-run confirmation, then the default workspace, then a save dialog if that fails.
 */
async function ensureAutoSaveTarget(tab) {
  if (!tab || tab.filePath || pendingTargets.has(tab.id) || declinedTargets.has(tab.id)) return;
  const api = window.engineAPI;
  if (!api) return;

  pendingTargets.add(tab.id);
  try {
    const content = tab.model ? tab.model.getValue() : '';
    let firstRunDone = false;
    try { firstRunDone = localStorage.getItem(LOCATION_CONFIRMED_KEY) === 'true'; } catch { /* storage unavailable */ }

    let useDefault = true;
    if (!firstRunDone) {
      useDefault = window.confirm(t('autosave_location_confirm'));
      try { localStorage.setItem(LOCATION_CONFIRMED_KEY, 'true'); } catch { /* storage unavailable */ }
    }

    if (useDefault) {
      const ws = await api.getDefaultWorkspace(true);
      if (ws?.success && ws.path) {
        const sep = ws.path.includes('\\') ? '\\' : '/';
        const fileName = `${(tab.title || 'Untitled').replace(/\.md$/i, '')}-${Date.now()}.md`;
        const res = await api.saveFile(content, `${ws.path}${sep}${fileName}`, false);
        if (res?.success) {
          tab.filePath = res.filePath;
          editorEvents.emit('onTabRenderNeeded');
          return;
        }
      }
    }

    // Default workspace unavailable, or the user chose another location.
    if (useDefault) window.alert(t('autosave_location_failed'));
    const res = await api.saveFile(content, undefined, true);
    if (res?.success && res.filePath) {
      tab.filePath = res.filePath;
      editorEvents.emit('onTabRenderNeeded');
    } else if (res?.canceled) {
      // Do not reopen the dialog on every keystroke; the user can re-enable AUTO to retry.
      declinedTargets.add(tab.id);
    }
  } catch (err) {
    console.warn('[AutoSave] Could not resolve a save location:', err);
  } finally {
    pendingTargets.delete(tab.id);
    updateAutoSaveUI();
    // Text typed while the location was unknown is still only a draft. Write it now that a path exists.
    const autoSaveOn = localStorage.getItem(STORAGE_KEYS.AUTO_SAVE) !== 'false';
    if (autoSaveOn && tab.filePath && tab.isDirty) executeSave(tab);
  }
}

export function triggerAdaptiveAutoSave(tab, immediate = false) {
  const isAutoSaveEnabled = localStorage.getItem(STORAGE_KEYS.AUTO_SAVE) !== 'false';
  if (!isAutoSaveEnabled || !tab || !tab.model) return;

  if (!tab.filePath) {
    ensureAutoSaveTarget(tab);
  }

  if (autoSaveTimers.has(tab.id)) {
    clearTimeout(autoSaveTimers.get(tab.id));
  }

  if (immediate) {
    executeSave(tab);
    return;
  }

  const timer = setTimeout(() => executeSave(tab), adhap.BASE_DELAY_MS);
  autoSaveTimers.set(tab.id, timer);
}
