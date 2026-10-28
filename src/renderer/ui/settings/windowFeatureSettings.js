/**
 * Settings-page controls for features that also live in the window: autosave, the AI assistants,
 * and the log panel at startup. Each control reads and writes through the same functions the window
 * uses, and follows the window when it changes the value, so the two never disagree.
 */
import { t } from '../../core/i18n.js';
import { aiManager } from '../../core/aiStateManager.js';
import { settingsStore } from '../../core/settingsStore.js';
import { showToast } from '../notifications/toastManager.js';
import { syncSettingsToBackend } from './settingsState.js';
import { isLayoutRemembered, setLayoutRemembered } from '../layout/layoutMemory.js';
import {
  AUTO_SAVE_DELAY_RANGE_MS,
  getAutoSaveDelayMs,
  setAutoSaveDelayMs,
  isAutoSaveEnabled,
  isIdleAutoSaveEnabled,
  isNewlineAutoSaveEnabled,
  setAutoSaveEnabled,
  setTriggers,
  updateAutoSaveUI
} from '../../editor/ui/autoSaveManager.js';

const LOGS_PATH = 'system.collapseLogsOnStartup';
const LOG_TIME_PATH = 'system.logTimeFormat';
const LOG_TIME_ZONE_PATH = 'system.logTimeZone';
const onOff = (value) => (value ? 'on' : 'off');

function bindAutoSave() {
  const all = document.getElementById('modalAutoSaveSelect');
  const idle = document.getElementById('modalAutoSaveIdleSelect');
  const newline = document.getElementById('modalAutoSaveNewlineSelect');
  const delay = document.getElementById('modalAutoSaveDelayInput');
  if (!all || !idle || !newline || !delay) return;

  delay.min = String(AUTO_SAVE_DELAY_RANGE_MS.min / 1000);
  delay.max = String(AUTO_SAVE_DELAY_RANGE_MS.max / 1000);
  delay.step = '0.5';

  const refresh = () => {
    all.value = onOff(isAutoSaveEnabled());
    idle.value = onOff(isIdleAutoSaveEnabled());
    newline.value = onOff(isNewlineAutoSaveEnabled());
    delay.value = String(getAutoSaveDelayMs() / 1000);
  };
  refresh();
  // The toolbar switch changes the same values
  window.addEventListener('app:autosaveChanged', refresh);

  all.addEventListener('change', () => setAutoSaveEnabled(all.value === 'on'));
  const saveTriggers = () => {
    setTriggers({ idle: idle.value === 'on', newline: newline.value === 'on' });
    syncSettingsToBackend();
    updateAutoSaveUI();
  };
  idle.addEventListener('change', saveTriggers);
  newline.addEventListener('change', saveTriggers);
  delay.addEventListener('change', () => {
    const seconds = Number(delay.value);
    if (Number.isFinite(seconds)) setAutoSaveDelayMs(seconds * 1000);
    syncSettingsToBackend();
    // Show the value that was kept after clamping to the allowed range
    delay.value = String(getAutoSaveDelayMs() / 1000);
  });
}

function bindAssistants() {
  const master = document.getElementById('modalLlmSwitchSelect');
  const embedding = document.getElementById('modalEmbeddingAssistantSelect');
  if (!master || !embedding) return;

  // "master" is the settings-page control of the LLM switch (it keeps its element id until the rename in planned.csv S04).
  // The two switches are independent (ADR-11).
  const refresh = () => {
    const state = aiManager.getState();
    master.value = onOff(state.llm);
    embedding.value = onOff(state.embed);
  };
  refresh();
  window.addEventListener('app:aiStateChanged', refresh);

  master.addEventListener('change', () => {
    const wantOn = master.value === 'on';
    try {
      if (wantOn && !aiManager.getState().llmConfigured) throw new Error(t('assistant_not_configured'));
      aiManager.setLlm(wantOn, 'settings');
      if (wantOn) window.dispatchEvent(new CustomEvent('app:openLlmChat', { detail: {} }));
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'warning');
      refresh();
    }
  });

  embedding.addEventListener('change', () => {
    const wantOn = embedding.value === 'on';
    try {
      if (wantOn && !aiManager.getState().embedConfigured) throw new Error(t('toast_embed_not_ready'));
      aiManager.setEmbed(wantOn, 'settings');
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'warning');
      refresh();
    }
  });
}

function bindLogsOnStart() {
  const select = document.getElementById('modalLogsOnStartSelect');
  if (!select) return;
  select.value = settingsStore.getPreference(LOGS_PATH) ? 'closed' : 'open';
  select.addEventListener('change', () => settingsStore.updatePreference(LOGS_PATH, select.value === 'closed'));
}

function bindLogTimeFormat() {
  const select = document.getElementById('modalLogTimeFormatSelect');
  if (!select) return;
  select.value = settingsStore.getPreference(LOG_TIME_PATH) || 'h24';
  select.addEventListener('change', () => settingsStore.updatePreference(LOG_TIME_PATH, select.value));
}

function bindLogTimeZone() {
  const select = document.getElementById('modalLogTimeZoneSelect');
  if (!select) return;
  select.value = settingsStore.getPreference(LOG_TIME_ZONE_PATH) || 'local';
  select.addEventListener('change', () => settingsStore.updatePreference(LOG_TIME_ZONE_PATH, select.value));
}

function bindRememberLayout() {
  const select = document.getElementById('modalRememberLayoutSelect');
  if (!select) return;
  select.value = onOff(isLayoutRemembered());
  select.addEventListener('change', () => {
    setLayoutRemembered(select.value === 'on');
    syncSettingsToBackend();
  });
}

let bound = false;

/** Wires the new controls once; initSettings can run again without stacking listeners. */
export function initWindowFeatureSettings() {
  if (bound) return;
  bound = true;
  bindAutoSave();
  bindAssistants();
  bindLogsOnStart();
  bindLogTimeFormat();
  bindLogTimeZone();
  bindRememberLayout();
}
