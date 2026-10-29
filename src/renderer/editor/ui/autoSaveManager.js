/**
 * AutoSave Manager - Plan A (Clear SAVE vs AUTO)
 */
import { STORAGE_KEYS, TIMINGS } from '../../core/constants.js';
import { t } from '../../core/i18n.js';
import { getWorkspaceRoot } from '../../core/workspaceRoot';
import { editorEvents } from '../core/editorEvents.js';
import { getActiveTab } from '../tabs/tabState.js';
import { markSavedAsUtf8 } from './statusBarManager.js';
import { commitTabToFile } from '../io/tabCommit.js';
import { showToast } from '../../ui/notifications/toastManager.js';
import { showConfirmModal } from '../../ui/notifications/confirmModal.js';
import { syncSettingsToBackend } from '../../ui/settings/settingsState.js';
import { formatOfName, withFormatExtension } from '../../../shared/documentFormat';

const adhap = {
  BASE_DELAY_MS: TIMINGS.AUTO_SAVE_BASE_MS || 1500,
  STATUS_NOTIFICATION_MS: 1500,
  MIN_DELAY_MS: 500,
  MAX_DELAY_MS: 10000
};

/** The pause after typing stops before the save, as the user set it (default 1.5 seconds). */
export function getAutoSaveDelayMs() {
  const stored = Number(localStorage.getItem(STORAGE_KEYS.AUTO_SAVE_DELAY));
  const ms = Number.isFinite(stored) && stored > 0 ? stored : adhap.BASE_DELAY_MS;
  return Math.min(adhap.MAX_DELAY_MS, Math.max(adhap.MIN_DELAY_MS, ms));
}

/** Stores the pause in milliseconds, kept within the allowed range. */
export function setAutoSaveDelayMs(ms) {
  const clamped = Math.min(adhap.MAX_DELAY_MS, Math.max(adhap.MIN_DELAY_MS, Math.round(ms)));
  localStorage.setItem(STORAGE_KEYS.AUTO_SAVE_DELAY, String(clamped));
}

export const AUTO_SAVE_DELAY_RANGE_MS = { min: adhap.MIN_DELAY_MS, max: adhap.MAX_DELAY_MS };

const autoSaveTimers = new Map();
const pendingTargets = new Set();
const declinedTargets = new Set();
/** Tabs whose latest write failed. The failure toast shows once per streak, not on every keystroke. */
const failingTabs = new Set();
const LOCATION_CONFIRMED_KEY = 'vectoreditor_autosave_location_confirmed';
let domCache = {};

function getDomElements() {
  if (!domCache.menuToggle) domCache.menuToggle = document.getElementById('btnAutoSaveToggle');
  if (!domCache.menuSwitch) domCache.menuSwitch = document.getElementById('autoSaveMenuSwitch');
  if (!domCache.labelEl) domCache.labelEl = document.getElementById('btnSaveLabel');
  if (!domCache.saveInd) domCache.saveInd = document.getElementById('statusSaveIndicator');
  if (!domCache.ledDot) domCache.ledDot = document.getElementById('autoSaveLedDot');
  if (!domCache.btnSave) domCache.btnSave = document.getElementById('btnSave');
  return domCache;
}

/** A trigger is on unless it was stored as off; a missing key follows the older single AutoSave flag. */
function isTriggerOn(key) {
  const stored = localStorage.getItem(key);
  if (stored === null) return localStorage.getItem(STORAGE_KEYS.AUTO_SAVE) !== 'false';
  return stored !== 'false';
}

/** Saves a pause after typing stops (about 1.5 seconds). */
export function isIdleAutoSaveEnabled() {
  return isTriggerOn(STORAGE_KEYS.AUTO_SAVE_IDLE);
}

/** Saves at each new line. */
export function isNewlineAutoSaveEnabled() {
  return isTriggerOn(STORAGE_KEYS.AUTO_SAVE_NEWLINE);
}

/** AutoSave runs while at least one of its two triggers is on. */
export function isAutoSaveEnabled() {
  return isIdleAutoSaveEnabled() || isNewlineAutoSaveEnabled();
}

/** Stores both triggers at once (the menu switch and the first-run switches use this). */
export function setTriggers({ idle, newline }) {
  localStorage.setItem(STORAGE_KEYS.AUTO_SAVE_IDLE, String(idle));
  localStorage.setItem(STORAGE_KEYS.AUTO_SAVE_NEWLINE, String(newline));
  localStorage.setItem(STORAGE_KEYS.AUTO_SAVE, String(idle || newline));
}

/** Turns AutoSave on or off. Turning it on retries a location the user declined earlier. */
export function setAutoSaveEnabled(enabled) {
  setTriggers({ idle: enabled, newline: enabled });
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
  // The settings page follows the toolbar switch
  window.dispatchEvent(new CustomEvent('app:autosaveChanged'));
  const enabled = isAutoSaveEnabled();
  const { menuToggle, menuSwitch, ledDot, labelEl, btnSave } = getDomElements();
  const activeTab = typeof getActiveTab === 'function' ? getActiveTab() : null;
  const filePath = activeTab?.filePath || '';

  let state = 'off';
  if (enabled) state = filePath ? 'on' : 'pending';
  const tooltip = state === 'on'
    ? t('autosave_state_on', { path: filePath })
    : t(`autosave_state_${state}`);

  if (labelEl) labelEl.textContent = state === 'on' ? t('btn_save_auto') : (state === 'pending' ? t('btn_save_as') : t('btn_save'));
  if (btnSave) btnSave.dataset.autosaveState = state;
  if (ledDot) {
    ledDot.className = `status-led-dot autosave-led is-${state}`;
    ledDot.title = tooltip;
  }
  if (btnSave) btnSave.title = `${t('btn_save_title')}\n${tooltip}`;
  if (menuToggle) {
    menuToggle.setAttribute('aria-checked', String(enabled));
    menuToggle.classList.toggle('is-checked', enabled);
  }
  if (menuSwitch) menuSwitch.setAttribute('aria-checked', String(enabled));
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
      useDefault = await showConfirmModal({
        message: t('autosave_location_confirm'),
        cancelText: t('btn_cancel'),
        type: 'info'
      });
      try { localStorage.setItem(LOCATION_CONFIRMED_KEY, 'true'); } catch { /* storage unavailable */ }
    }

    if (useDefault) {
      const ws = await getWorkspaceRoot({ create: true });
      if (ws) {
        const sep = ws.path.includes('\\') ? '\\' : '/';
        // The file keeps the format of its tab: a Text document is written as .txt, a Markdown one as .md
        const fileName = withFormatExtension(`${(tab.title || 'Untitled').replace(/\.(md|markdown|txt)$/i, '')}-${Date.now()}`, formatOfName(tab.title));
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

  if (immediate && isNewlineAutoSaveEnabled()) {
    executeSave(tab);
    return;
  }

  // A new line with only the pause trigger on waits for the pause, like any other edit
  if (!isIdleAutoSaveEnabled()) return;

  const timer = setTimeout(() => executeSave(tab), getAutoSaveDelayMs());
  autoSaveTimers.set(tab.id, timer);
}
