/**
 * Settings-page controls for features that also live in the window: autosave, the AI assistants,
 * and the log panel at startup. Each control reads and writes through the same functions the window
 * uses, and follows the window when it changes the value, so the two never disagree.
 */
import { t } from '../../core/i18n.js';
import { renderStoredLogs } from '../console/systemConsoleManager.js';
import { aiManager } from '../../core/aiStateManager.js';
import { settingsStore } from '../../core/settingsStore.js';
import { showToast } from '../notifications/toastManager.js';
import { syncSettingsToBackend } from './settingsState.js';
import {
  CUSTOM,
  DELAY_PRESETS_MS,
  UNIT_MS,
  UNIT_RANGE,
  formatDelayLabel,
  presetValueFor,
  splitForCustom,
  toMs
} from './autoSaveDelayOptions.js';
import { isLayoutRemembered, setLayoutRemembered } from '../layout/layoutMemory.js';
import {
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
const LOG_SAVE_PATH = 'system.logSaveMode';
const onOff = (value) => (value ? 'on' : 'off');

function bindAutoSave() {
  const all = document.getElementById('modalAutoSaveSelect');
  const idle = document.getElementById('modalAutoSaveIdleSelect');
  const newline = document.getElementById('modalAutoSaveNewlineSelect');
  const delay = document.getElementById('modalAutoSaveDelayInput');
  const delayPreset = document.getElementById('modalAutoSaveDelaySelect');
  const delayUnit = document.getElementById('modalAutoSaveDelayUnit');
  const customBox = document.getElementById('autoSaveDelayCustom');
  if (!all || !idle || !newline || !delay || !delayPreset || !delayUnit || !customBox) return;

  // The pause is a preset or the user's own amount in seconds or minutes; it is stored in milliseconds either way
  const buildPresets = () => {
    const names = { sec: t('autosave_unit_sec'), min: t('autosave_unit_min') };
    const chosen = delayPreset.value;
    delayPreset.replaceChildren(
      ...DELAY_PRESETS_MS.map((ms) => new Option(formatDelayLabel(ms, names), String(ms))),
      new Option(t('autosave_delay_custom'), CUSTOM)
    );
    delayPreset.value = chosen;
  };
  const applyUnit = (unit) => {
    const range = UNIT_RANGE[unit];
    delay.min = String(range.min);
    delay.max = String(range.max);
    delay.step = String(range.step);
    delay.dispatchEvent(new Event('input', { bubbles: true })); // the stepper re-reads the limits
  };
  const showDelay = (ms, custom) => {
    delayPreset.value = custom ? CUSTOM : presetValueFor(ms);
    customBox.hidden = delayPreset.value !== CUSTOM;
    const { unit, amount } = splitForCustom(ms);
    delayUnit.value = unit;
    applyUnit(unit);
    delay.value = String(amount);
  };

  // The wait only applies to "Save when typing pauses": with that off the row is inactive and says why in text
  const delayRow = delay.closest('[data-setting-row]');
  const delayReason = document.getElementById('autoSaveDelayReason');
  const syncDelayState = () => {
    const inactive = idle.value !== 'on';
    delayRow?.classList.toggle('is-inactive', inactive);
    if (delayReason) delayReason.hidden = !inactive;
    delayRow?.querySelectorAll('input, select, button').forEach((el) => {
      if (!el.closest('[data-setting-text]')) el.disabled = inactive; // the info button of the label stays usable
    });
    // Back on: let the stepper set its − and + buttons to their own limits again
    if (!inactive) delay.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const refresh = () => {
    all.value = onOff(isAutoSaveEnabled());
    idle.value = onOff(isIdleAutoSaveEnabled());
    newline.value = onOff(isNewlineAutoSaveEnabled());
    showDelay(getAutoSaveDelayMs(), delayPreset.value === CUSTOM);
    syncDelayState();
  };
  buildPresets();
  refresh();
  window.addEventListener('app:languageChanged', buildPresets);
  // The toolbar switch changes the same values
  window.addEventListener('app:autosaveChanged', refresh);

  all.addEventListener('change', () => setAutoSaveEnabled(all.value === 'on'));
  const saveTriggers = () => {
    setTriggers({ idle: idle.value === 'on', newline: newline.value === 'on' });
    syncSettingsToBackend();
    updateAutoSaveUI();
    syncDelayState();
  };
  idle.addEventListener('change', saveTriggers);
  newline.addEventListener('change', saveTriggers);
  delayPreset.addEventListener('change', () => {
    if (delayPreset.value !== CUSTOM) setAutoSaveDelayMs(Number(delayPreset.value));
    syncSettingsToBackend();
    showDelay(getAutoSaveDelayMs(), delayPreset.value === CUSTOM);
  });
  // Typed amount or unit: kept to the allowed range, and shown again in the unit the user chose
  const commitCustomDelay = () => {
    const ms = toMs(delay.value, delayUnit.value);
    if (Number.isFinite(ms)) setAutoSaveDelayMs(ms);
    syncSettingsToBackend();
    delay.value = String(getAutoSaveDelayMs() / UNIT_MS[delayUnit.value]);
  };
  delay.addEventListener('change', commitCustomDelay);
  delayUnit.addEventListener('change', () => {
    applyUnit(delayUnit.value);
    commitCustomDelay();
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

function bindLogSaveMode() {
  const select = document.getElementById('modalLogSaveModeSelect');
  if (!select) return;
  select.value = settingsStore.getPreference(LOG_SAVE_PATH) || 'never';
  select.addEventListener('change', () => settingsStore.updatePreference(LOG_SAVE_PATH, select.value));
}

/** Saved sessions: the list comes from the main process (names and sizes only); a session is read when chosen. */
function bindLogSessions() {
  const select = document.getElementById('modalLogSessionSelect');
  const open = document.getElementById('btnLogSessionOpen');
  const view = document.getElementById('logSessionView');
  if (!select || !open || !view) return;

  const refresh = async () => {
    const sessions = (await window.engineAPI?.listLogSessions?.()) ?? [];
    const options = sessions.map((s) => {
      const option = document.createElement('option');
      option.value = s.id;
      option.textContent = `${s.modified.replace('T', ' ').slice(0, 19)} (${Math.max(1, Math.round(s.bytes / 1024))} KB)`;
      return option;
    });
    if (options.length === 0) {
      const none = document.createElement('option');
      none.value = '';
      none.textContent = t('log_session_none');
      options.push(none);
    }
    select.replaceChildren(...options);
  };
  refresh();

  open.addEventListener('click', async () => {
    if (!select.value) return;
    const entries = (await window.engineAPI?.readLogSession?.(select.value)) ?? [];
    renderStoredLogs(view, entries);
    view.hidden = false;
  });
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
  bindLogSaveMode();
  bindLogSessions();
  bindRememberLayout();
}
