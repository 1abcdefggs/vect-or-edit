/**
 * The Gemini model the user chose. The model is always the user's choice: nothing is picked for them,
 * so this is an empty string until they choose one from the model list in Settings.
 * A stored value that is not a plain model id counts as not chosen.
 */
import { STORAGE_KEYS } from './constants.js';
import { readStorage } from './storage.js';
import { isValidGeminiModelId } from '../../shared/geminiModels';

export function readGeminiModel() {
  const saved = readStorage(STORAGE_KEYS.GEMINI_MODEL);
  return isValidGeminiModelId(saved) ? saved : '';
}
