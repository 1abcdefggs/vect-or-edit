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
import { setSettingRowLocked, applySuggestFunctionLock } from './settingsLocks.js';
import { readStorage } from '../../core/storage.js';
import { STORAGE_KEYS } from '../../core/constants.js';
import { llmSwitchReasonKey, llmSwitchNoteKey } from './llmSwitchLock.js';
import { getChatPlacement, setChatPlacement } from '../ai/chatPlacement.js';
import {
  CUSTOM,
  DELAY_PRESETS_MS,
  UNIT_MS,
  formatClock,
  formatDelayAmount,
  parseClock,
  presetValueFor
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
const LOG_LANGUAGE_PATH = 'system.logLanguage';
const LOG_SAVE_PATH = 'system.logSaveMode';
const onOff = (value) => (value ? 'on' : 'off');

function bindAutoSave() {
  const all = document.getElementById('modalAutoSaveSelect');
  const idle = document.getElementById('modalAutoSaveIdleSelect');
  const newline = document.getElementById('modalAutoSaveNewlineSelect');
  const delay = document.getElementById('modalAutoSaveDelayInput');
  const delayPreset = document.getElementById('modalAutoSaveDelaySelect');
  if (!all || !idle || !newline || !delay || !delayPreset) return;

  // The pause is a preset or the user's own m:ss value; it is stored in milliseconds either way
  const buildPresets = () => {
    const unitLabel = { sec: t('autosave_unit_sec'), min: t('autosave_unit_min') };
    const chosen = delayPreset.value;
    // Seconds, minutes and the own value are separate groups (rows); the first option of a unit group carries the row heading
    const withGroup = (option, group, heading) => {
      option.dataset.group = group;
      if (heading) option.dataset.groupLabel = heading;
      return option;
    };
    const presetOptions = DELAY_PRESETS_MS.map((ms) => {
      const unit = ms >= UNIT_MS.min ? 'min' : 'sec';
      const first = unit === 'sec' ? DELAY_PRESETS_MS.find((p) => p < UNIT_MS.min) : DELAY_PRESETS_MS.find((p) => p >= UNIT_MS.min);
      return withGroup(new Option(formatDelayAmount(ms), String(ms)), unit, ms === first ? unitLabel[unit] : '');
    });
    delayPreset.replaceChildren(
      ...presetOptions,
      withGroup(new Option(t('autosave_delay_custom'), CUSTOM), 'custom', '')
    );
    delayPreset.value = chosen;
  };
  // The typed field is always shown beside the list, so the value can be typed without choosing "自分で指定" first
  const showDelay = (ms, custom) => {
    delayPreset.value = custom ? CUSTOM : presetValueFor(ms);
    delay.value = formatClock(ms);
  };

  // With Autosave off, the trigger and the wait do nothing: those rows are locked and say why in text.
  // The wait also needs "Save when typing pauses" on.
  const delayRow = delay.closest('[data-setting-row]');
  const delayReason = document.getElementById('autoSaveDelayReason');
  const offReason = document.getElementById('autoSaveOffReason');
  const syncDelayState = () => {
    const masterOff = all.value !== 'on';
    const idleOff = idle.value !== 'on';
    setSettingRowLocked('modalAutoSaveIdleSelect', masterOff);
    setSettingRowLocked('modalAutoSaveNewlineSelect', masterOff);
    if (offReason) offReason.hidden = !masterOff;
    const inactive = masterOff || idleOff;
    delayRow?.classList.toggle('is-inactive', inactive);
    if (delayReason) delayReason.hidden = masterOff || !idleOff;
    delayRow?.querySelectorAll('input, select, button').forEach((el) => {
      if (!el.closest('[data-setting-text]')) el.disabled = inactive; // the info button of the label stays usable
    });
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

  all.addEventListener('change', () => {
    setAutoSaveEnabled(all.value === 'on');
    syncDelayState();
  });
  const saveTriggers = () => {
    setTriggers({ idle: idle.value === 'on', newline: newline.value === 'on' });
    syncSettingsToBackend();
    updateAutoSaveUI();
    syncDelayState();
  };
  idle.addEventListener('change', saveTriggers);
  newline.addEventListener('change', saveTriggers);
  delayPreset.addEventListener('change', () => {
    if (delayPreset.value === CUSTOM) {
      delay.focus(); // the typed field is already visible: choosing the custom preset moves focus to it
      return;
    }
    setAutoSaveDelayMs(Number(delayPreset.value));
    syncSettingsToBackend();
    showDelay(getAutoSaveDelayMs(), false);
  });
  // Typed m:ss value: kept to the allowed range by setAutoSaveDelayMs; text that is not m:ss is dropped and the stored value is shown again
  delay.addEventListener('change', () => {
    const ms = parseClock(delay.value);
    if (Number.isFinite(ms)) setAutoSaveDelayMs(ms);
    syncSettingsToBackend();
    delay.value = formatClock(getAutoSaveDelayMs());
  });
}

function bindAssistants() {
  const master = document.getElementById('modalLlmSwitchSelect');
  const embedding = document.getElementById('modalEmbeddingAssistantSelect');
  if (!master || !embedding) return;

  // "master" is the settings-page control of the LLM switch (it keeps its element id until the rename in planned.csv S04).
  // The two switches are independent (ADR-11).
  // The switch cannot be turned on before a provider is chosen and its key is stored (the same condition as the title-bar
  // button): it is locked and the text under it says which step is missing. Only the control is locked, so the text stays readable.
  const masterRow = master.closest('[data-setting-row]');
  const masterReason = document.getElementById('llmSwitchReason');
  // The missing step also stands beside the switch, where the eye goes after pressing it; the full reason stays in the text block
  const syncMasterNote = (noteKey) => {
    let note = masterRow?.querySelector('.setting-inline-note');
    if (!noteKey) { note?.remove(); return; }
    if (!note) {
      note = document.createElement('span');
      note.className = 'setting-inline-note';
      // querySelector can return a descendant, which insertBefore rejects; insert beside the switch element itself
      const switchEl = masterRow?.querySelector('.ui-switch');
      const anchor = switchEl && switchEl.parentElement === masterRow ? switchEl : master;
      anchor.before(note);
    }
    note.dataset.i18n = noteKey;
    note.textContent = t(noteKey);
  };
  const syncMasterLock = (state) => {
    const reasonKey = llmSwitchReasonKey(readStorage(STORAGE_KEYS.LLM_PROVIDER), state.llmConfigured);
    const locked = reasonKey !== null;
    master.disabled = locked;
    masterRow?.classList.toggle('is-inactive', locked);
    syncMasterNote(llmSwitchNoteKey(reasonKey));
    if (masterReason) {
      masterReason.hidden = !locked;
      if (locked) {
        masterReason.dataset.i18n = reasonKey;
        masterReason.textContent = t(reasonKey);
      }
    }
  };
  const refresh = () => {
    const state = aiManager.getState();
    master.value = onOff(state.llm);
    embedding.value = onOff(state.embed);
    syncMasterLock(state);
    applySuggestFunctionLock();
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
      applySuggestFunctionLock();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), 'warning');
      refresh();
    }
  });
}

/** The place of the AI chat: the same value as the move button in the chat header and the right-click items. */
function bindChatPlacement() {
  const select = document.getElementById('modalChatPlacementSelect');
  if (!select) return;
  const refresh = () => { select.value = getChatPlacement(); };
  refresh();
  window.addEventListener('app:chatPlacementChanged', refresh);
  select.addEventListener('change', () => setChatPlacement(select.value));
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

function bindLogLanguage() {
  const select = document.getElementById('modalLogLanguageSelect');
  if (!select) return;
  select.value = settingsStore.getPreference(LOG_LANGUAGE_PATH) || 'en';
  select.addEventListener('change', () => settingsStore.updatePreference(LOG_LANGUAGE_PATH, select.value));
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
  // The empty-state option is a sentence written with t(), so it is written again in the new language
  window.addEventListener('app:languageChanged', refresh);

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
  bindChatPlacement();
  bindLogsOnStart();
  bindLogTimeFormat();
  bindLogTimeZone();
  bindLogLanguage();
  bindLogSaveMode();
  bindLogSessions();
  bindRememberLayout();
}
