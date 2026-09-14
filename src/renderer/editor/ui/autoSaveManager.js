/**
 * AutoSave Manager - Plan A (Clear SAVE vs AUTO)
 */
import { STORAGE_KEYS, TIMINGS } from '../../core/constants.js';
import { i18n, t } from '../../core/i18n.js';
import { editorEvents } from '../core/editorEvents.js';
import { getActiveTab } from '../tabs/tabState.js';

const adhap = {
  BASE_DELAY_MS: TIMINGS.AUTO_SAVE_BASE_MS || 1500,
  STATUS_NOTIFICATION_MS: 1500
};

const autoSaveTimers = new Map();
let domCache = {};

function getDomElements() {
  if (!domCache.chkToggle) domCache.chkToggle = document.getElementById('chkAutoSaveToggle');
  if (!domCache.labelEl) domCache.labelEl = document.getElementById('autoSaveLabel') || document.getElementById('btnSaveLabel');
  if (!domCache.saveInd) domCache.saveInd = document.getElementById('statusSaveIndicator');
  if (!domCache.ledDot) domCache.ledDot = document.getElementById('autoSaveLedDot');
  return domCache;
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
        ledDot.className = 'setting-led-dot';
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
      updateAutoSaveUI();
    });
  }
  if (ledDot) {
    ledDot.addEventListener('click', (e) => {
      e.stopPropagation();
      const current = localStorage.getItem(STORAGE_KEYS.AUTO_SAVE) !== 'false';
      localStorage.setItem(STORAGE_KEYS.AUTO_SAVE, String(!current));
      updateAutoSaveUI();
    });
  }
  updateAutoSaveUI();
  editorEvents.on('onTabRenderNeeded', () => updateAutoSaveUI());
}

function executeSave(tab) {
  if (!tab || !tab.model) return;
  try {
    const content = tab.model.getValue();
    localStorage.setItem(`autosave_${tab.id}`, JSON.stringify({
      title: tab.title,
      content,
      filePath: tab.filePath || null,
      timestamp: Date.now()
    }));

    if (tab.filePath && window.engineAPI?.saveFileDirect) {
      window.engineAPI.saveFileDirect(tab.filePath, content).catch(err => {
        console.warn('[AutoSave] Direct file write failed:', err);
      });
    }

    tab.isDirty = false;
    editorEvents.emit('onTabRenderNeeded');

    const { saveInd } = getDomElements();
    if (saveInd) {
      saveInd.textContent = t('status_saved');
      saveInd.style.opacity = '1';
      setTimeout(() => {
        if (saveInd) saveInd.style.opacity = '0.5';
      }, adhap.STATUS_NOTIFICATION_MS);
    }
  } catch (err) {
    console.warn('[AutoSave] Save failed:', err);
  }
}

export function triggerAdaptiveAutoSave(tab, immediate = false) {
  const isAutoSaveEnabled = localStorage.getItem(STORAGE_KEYS.AUTO_SAVE) !== 'false';
  if (!isAutoSaveEnabled || !tab || !tab.model) return;

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
