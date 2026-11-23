/**
 * The short model list of the quick menu in the chat header.
 *
 * OpenAI and Claude: their fixed lists. Gemini: the newest text models of the list the user already fetched
 * (the full list, search and sorting stay in the Models tab and on the settings page). The model in use is always in the
 * list, at the top, even when it is not among the first ones, so the menu never hides the user's own choice.
 *
 * Public surface: QuickModel, GEMINI_QUICK_LIMIT, quickModels.
 */
import { CLAUDE_CHAT_MODELS, OPENAI_CHAT_MODELS } from '../../../shared/chatModels';
import { groupGeminiModels } from '../../../shared/geminiModels';

export interface QuickModel {
  id: string;
  label: string;
  current: boolean;
}

export const GEMINI_QUICK_LIMIT = 8;

function geminiLabel(name: string, displayName: string): string {
  return displayName || name;
}

export function quickModels(provider: string, currentId: string, geminiList: unknown): QuickModel[] {
  let models: Array<{ id: string; label: string }> = [];
  if (provider === 'openai') models = OPENAI_CHAT_MODELS.map((m) => ({ id: m.id, label: m.label }));
  else if (provider === 'claude') models = CLAUDE_CHAT_MODELS.map((m) => ({ id: m.id, label: m.label }));
  else if (provider === 'gemini') {
    models = groupGeminiModels(geminiList)
      .flatMap((group) => group.models)
      .filter((m) => m.purpose === 'text')
      .map((m) => ({ id: m.name, label: geminiLabel(m.name, m.displayName) }))
      .slice(0, GEMINI_QUICK_LIMIT);
  }
  const list: QuickModel[] = models.map((m) => ({ ...m, current: m.id === currentId }));
  // The model in use goes first when it is not in the short list (an older model, or one chosen in the Models tab)
  if (currentId && !list.some((m) => m.current)) list.unshift({ id: currentId, label: currentId, current: true });
  return list;
}
