/**
 * llmProviderMigration.ts - the cloud LLM provider used to share the `ai_provider` key with the search
 * generator. It now has its own key, `llm_provider`. A user who had picked a cloud provider keeps it;
 * everyone else starts with none. The search generator keeps `ai_provider` untouched.
 */
import { DEFAULTS, STORAGE_KEYS } from './constants';

const CLOUD_PROVIDERS = ['gemini', 'openai', 'claude'];

export function migrateLlmProvider(storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): void {
  if (storage.getItem(STORAGE_KEYS.LLM_PROVIDER) !== null) return;
  const previous = storage.getItem(STORAGE_KEYS.AI_PROVIDER) ?? '';
  storage.setItem(STORAGE_KEYS.LLM_PROVIDER, CLOUD_PROVIDERS.includes(previous) ? previous : DEFAULTS.LLM_PROVIDER);
}
