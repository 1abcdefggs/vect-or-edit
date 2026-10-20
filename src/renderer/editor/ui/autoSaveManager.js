/**
 * AutoSave Manager - Plan A (Clear SAVE vs AUTO)
 */
import { STORAGE_KEYS, TIMINGS } from '../../core/constants.js';
import { t } from '../../core/i18n.js';
import { editorEvents } from '../core/editorEvents.js';
import { getActiveTab } from '../tabs/tabState.js';
import { markSavedAsUtf8 } from './statusBarManager.js';
import { commitTabToFile } from '../io/tabCommit.js';
import { showToast } from '../../ui/notifications/toastManager.js';
import { syncSettingsToBackend } from '../../ui/settings/settingsState.js';

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
  if (!domCache.menuToggle) domCache.menuToggle = document.getElementById('btnAutoSaveToggle');
  if (!domCache.labelEl) domCache.labelEl = document.getElementById('btnSaveLabel');
  if (!domCache.saveInd) domCache.saveInd = document.getElementById('statusSaveIndicator');
  if (!domCache.ledDot) domCache.ledDot = document.getElementById('autoSaveLedDot');
  if (!domCache.btnSave) domCache.btnSave = document.getElementById('btnSave');
  return domCache;
}

export function isAutoSaveEnabled() {
  return localStorage.getItem(STORAGE_KEYS.AUTO_SAVE) !== 'false';
}

/** Turns AutoSave on or off. Turning it on retries a location the user declined earlier. */
export function setAutoSaveEnabled(enabled) {
  localStorage.setItem(STORAGE_KEYS.AUTO_SAVE, String(enabled));
  syncSettingsToBackend();
  if (enabled) {
    declinedTargets.clear();
    ensureAutoSaveTarget(getActiveTab());
  }
  updateAutoSaveUI();
}

/** Records that the user accepted the default folder (first-run setup), so typing never opens the location prompt. */
export function markAutoSaveLocationConfirmed() {
  try { localStorage.setItem(LOCATION_CONFIRMED_KEY, 'true'); } catch { /* storage unavailable */ }
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

/**
 * Shows the AutoSave state on the save button: label AUTO or SAVE, the LED colour (CSS state class),
 * the tooltip, and the check mark of the save menu item.
 */
export function updateAutoSaveUI() {
  const enabled = isAutoSaveEnabled();
  const { menuToggle, ledDot, labelEl, btnSave } = getDomElements();
  const activeTab = typeof getActiveTab === 'function' ? getActiveTab() : null;
  const filePath = activeTab?.filePath || '';

  let state = 'off';
  if (enabled) state = filePath ? 'on' : 'pending';
  const tooltip = state === 'on'
    ? t('autosave_state_on', { path: filePath })
    : t(`autosave_state_${state}`);

  if (labelEl) labelEl.textContent = state === 'on' ? t('btn_save_auto') : t('btn_save');
  if (ledDot) {
    ledDot.className = `status-led-dot autosave-led is-${state}`;
    ledDot.title = tooltip;
  }
  if (btnSave) btnSave.title = `${t('btn_save_title')}\n${tooltip}`;
  if (menuToggle) {
    menuToggle.setAttribute('aria-checked', String(enabled));
    menuToggle.classList.toggle('is-checked', enabled);
  }
}

export function initAutoSaveControls() {
  const { menuToggle } = getDomElements();
  if (menuToggle) {
    menuToggle.addEventListener('click', () => setAutoSaveEnabled(!isAutoSaveEnabled()));
  }
  updateAutoSaveUI();
  editorEvents.on('onTabRenderNeeded', () => updateAutoSaveUI());
  window.addEventListener('app:languageChanged', () => updateAutoSaveUI());
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
    if (isAutoSaveEnabled() && tab.filePath && tab.isDirty) executeSave(tab);
  }
}

export function triggerAdaptiveAutoSave(tab, immediate = false) {
  if (!isAutoSaveEnabled() || !tab || !tab.model) return;

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
