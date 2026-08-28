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
  btnToggle: null,
  labelEl: null,
  iconEl: null,
  saveInd: null
};

function getDomElements() {
  if (!domCache.btnToggle) domCache.btnToggle = document.getElementById('btnToggleAutoSave');
  if (!domCache.labelEl) domCache.labelEl = document.getElementById('autoSaveLabel');
  if (!domCache.iconEl) domCache.iconEl = document.getElementById('autoSaveIcon');
  if (!domCache.saveInd) domCache.saveInd = document.getElementById('statusSaveIndicator');
  return domCache;
}

export function updateAutoSaveUI() {
  const isAutoSaveEnabled = localStorage.getItem(STORAGE_KEYS.AUTO_SAVE) !== 'false';
  const { btnToggle, labelEl, iconEl } = getDomElements();

  if (btnToggle && labelEl && iconEl) {
    if (isAutoSaveEnabled) {
      btnToggle.style.background = 'rgba(16, 185, 129, 0.12)';
      btnToggle.style.borderColor = 'rgba(16, 185, 129, 0.35)';
      btnToggle.style.color = 'var(--success-color, #10b981)';
      labelEl.textContent = i18n.autosave_on || 'Auto-Save: ON';
      iconEl.style.color = 'var(--success-color, #10b981)';
      btnToggle.title = i18n.tooltip_autosave_on || 'Adaptive Auto-Save: Enabled (Intelligently extends interval during heavy load)';
    } else {
      btnToggle.style.background = 'rgba(148, 163, 184, 0.1)';
      btnToggle.style.borderColor = 'rgba(148, 163, 184, 0.3)';
      btnToggle.style.color = 'var(--text-muted, #94a3b8)';
      labelEl.textContent = i18n.autosave_off || 'Auto-Save: OFF';
      iconEl.style.color = 'var(--text-muted, #94a3b8)';
      btnToggle.title = i18n.tooltip_autosave_off || 'Auto-Save: Disabled (Manual Save Ctrl+S required)';
    }
  }
}

export function initAutoSaveControls() {
  const { btnToggle } = getDomElements();
  if (btnToggle) {
    btnToggle.addEventListener('click', () => {
      const current = localStorage.getItem(STORAGE_KEYS.AUTO_SAVE) !== 'false';
      const next = !current;
      localStorage.setItem(STORAGE_KEYS.AUTO_SAVE, String(next));
      updateAutoSaveUI();
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
