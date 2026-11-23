// Settings rows that cannot be used while the thing they work on is off or not loaded.
// A locked row is dimmed (is-inactive) and cannot be operated (inert). The reason is shown as text by the caller.

import { aiManager } from '../../core/aiStateManager.js';

const SUGGEST_FUNCTION_IDS = ['modalSuggestTriggerSelect', 'modalMinScoreInput', 'modalLimitSelect'];

let dictionaryCount = 0;

export function setSettingRowLocked(controlId, locked) {
  const row = document.getElementById(controlId)?.closest('[data-setting-row]');
  if (!row) return;
  row.inert = locked;
  row.classList.toggle('is-inactive', locked);
}

function setReasonShown(id, shown) {
  const el = document.getElementById(id);
  if (el) el.hidden = !shown;
}

// The suggestion functions (trigger, minimum score, limit) need the embedding model switched on,
// the model downloaded (configured), and a dictionary loaded. The first missing condition is the reason shown.
export function applySuggestFunctionLock() {
  const embedOn = document.getElementById('modalEmbeddingAssistantSelect')?.value === 'on';
  const modelReady = aiManager.getState().embedConfigured;
  const noDictionary = dictionaryCount === 0;
  const locked = !embedOn || !modelReady || noDictionary;
  for (const id of SUGGEST_FUNCTION_IDS) setSettingRowLocked(id, locked);
  setReasonShown('suggestEmbedOffReason', !embedOn);
  setReasonShown('suggestModelNotReadyReason', embedOn && !modelReady);
  setReasonShown('suggestNoDictReason', embedOn && modelReady && noDictionary);
}

export function setDictionaryCount(count) {
  dictionaryCount = count;
  applySuggestFunctionLock();
}
