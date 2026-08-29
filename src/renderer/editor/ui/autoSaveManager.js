import { STORAGE_KEYS, TIMINGS } from '../../core/constants.js';
import { i18n, t } from '../../core/i18n.js';
import { editorEvents } from '../core/editorEvents.js';

// Configuration thresholds
const ADAPTIVE_THRESHOLDS = {
  HIGH_LOAD_HEAP_MB: 160,
  HIGH_LOAD_DOC_LEN: 120000,
  HIGH_LOAD_EDITS: 20,
  HIGH_LOAD_DELAY_MS: 4500,

  MEDIUM_LOAD_HEAP_MB: 100,
  MEDIUM_LOAD_DOC_LEN: 40000,
  MEDIUM_LOAD_EDITS: 8,
  MEDIUM_LOAD_DELAY_MS: 3000,

  BASE_DELAY_MS: TIMINGS.AUTO_SAVE_BASE_MS || 1500,
  EDIT_COUNTER_RESET_MS: 3000,
  STATUS_NOTIFICATION_MS: 1500
};

const autoSaveTimers = new Map();
let recentEditCount = 0;
let editCounterResetTimer = null;

// Cached DOM references
const domCache = {
  chkToggle: null,
  labelEl: null,
  iconEl: null,
  saveInd: null
};

function getDomElements() {
  if (!domCache.chkToggle) domCache.chkToggle = document.getElementById('chkAutoSaveToggle');
  if (!domCache.labelEl) domCache.labelEl = document.getElementById('autoSaveLabel');
  if (!domCache.iconEl) domCache.iconEl = document.getElementById('autoSaveIcon');
  if (!domCache.saveInd) domCache.saveInd = document.getElementById('statusSaveIndicator');
  return domCache;
}

export function updateAutoSaveUI() {
  const isAutoSaveEnabled = localStorage.getItem(STORAGE_KEYS.AUTO_SAVE) !== 'false';
  const { chkToggle } = getDomElements();

  if (chkToggle) {
    chkToggle.checked = isAutoSaveEnabled;
  }
}

export function initAutoSaveControls() {
  const { chkToggle } = getDomElements();
  if (chkToggle) {
    // Add change listener instead of click
    chkToggle.addEventListener('change', (e) => {
      localStorage.setItem(STORAGE_KEYS.AUTO_SAVE, String(e.target.checked));
      updateAutoSaveUI();
    });
    
    // Prevent the change from triggering a save button click
    chkToggle.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
  updateAutoSaveUI();
}

function executeSave(tab, isAutoSaveEnabled) {
  if (!tab || !tab.model) return;
  try {
    const content = tab.model.getValue();
    localStorage.setItem(`autosave_${tab.id}`, JSON.stringify({
      title: tab.title,
      content,
      timestamp: Date.now()
    }));

    tab.isDirty = false;
    editorEvents.emit('onTabRenderNeeded');

    const { saveInd, labelEl } = getDomElements();
    if (saveInd) {
      saveInd.textContent = t('status_saved');
      saveInd.style.opacity = '1';
      setTimeout(() => {
        if (saveInd) {
          saveInd.style.opacity = '0.5';
          saveInd.textContent = 'Auto-Save';
        }
      }, ADAPTIVE_THRESHOLDS.STATUS_NOTIFICATION_MS);
    }

    if (labelEl && isAutoSaveEnabled) {
      labelEl.textContent = `Auto-Save: ${t('status_saved')}`;
      setTimeout(() => {
        if (labelEl) labelEl.textContent = t('autosave_on');
      }, ADAPTIVE_THRESHOLDS.STATUS_NOTIFICATION_MS);
    }
  } catch (err) {
    console.warn('[AutoSave] Save failed:', err);
  }
}

function calculateAdaptiveDelay(tab) {
  let delay = ADAPTIVE_THRESHOLDS.BASE_DELAY_MS;
  try {
    const memory = performance?.memory;
    const currentMemoryMB = memory ? memory.usedJSHeapSize / (1024 * 1024) : 40;
    const contentLength = tab.model.getValueLength();

    if (
      currentMemoryMB > ADAPTIVE_THRESHOLDS.HIGH_LOAD_HEAP_MB ||
      contentLength > ADAPTIVE_THRESHOLDS.HIGH_LOAD_DOC_LEN ||
      recentEditCount > ADAPTIVE_THRESHOLDS.HIGH_LOAD_EDITS
    ) {
      delay = ADAPTIVE_THRESHOLDS.HIGH_LOAD_DELAY_MS;
    } else if (
      currentMemoryMB > ADAPTIVE_THRESHOLDS.MEDIUM_LOAD_HEAP_MB ||
      contentLength > ADAPTIVE_THRESHOLDS.MEDIUM_LOAD_DOC_LEN ||
      recentEditCount > ADAPTIVE_THRESHOLDS.MEDIUM_LOAD_EDITS
    ) {
      delay = ADAPTIVE_THRESHOLDS.MEDIUM_LOAD_DELAY_MS;
    }
  } catch (_) {}
  return delay;
}

export function triggerAdaptiveAutoSave(tab, immediate = false) {
  const isAutoSaveEnabled = localStorage.getItem(STORAGE_KEYS.AUTO_SAVE) !== 'false';
  if (!isAutoSaveEnabled || !tab || !tab.model) return;

  if (autoSaveTimers.has(tab.id)) {
    clearTimeout(autoSaveTimers.get(tab.id));
  }

  if (immediate) {
    executeSave(tab, isAutoSaveEnabled);
    return;
  }

  recentEditCount++;
  if (editCounterResetTimer) clearTimeout(editCounterResetTimer);
  editCounterResetTimer = setTimeout(() => {
    recentEditCount = 0;
  }, ADAPTIVE_THRESHOLDS.EDIT_COUNTER_RESET_MS);

  const delay = calculateAdaptiveDelay(tab);
  const timer = setTimeout(() => executeSave(tab, isAutoSaveEnabled), delay);
  autoSaveTimers.set(tab.id, timer);
}
