/**
 * llmProviders.ts - the cloud LLM providers the app offers, in display order, with the one name each is shown by
 * (owner decision 2026-11-17: Google Gemini, OpenAI, Claude; Bedrock is not offered).
 * Brand names are the same in every language, so they live here and not in the locale files.
 */
export const LLM_PROVIDERS = [
  { id: 'gemini', name: 'Google Gemini' },
  { id: 'openai', name: 'OpenAI' },
  { id: 'claude', name: 'Claude' }
] as const;

export type LlmProviderId = (typeof LLM_PROVIDERS)[number]['id'];

/** Display name of a provider id; an unknown id is returned unchanged. */
export function llmProviderName(id: string): string {
  return LLM_PROVIDERS.find((p) => p.id === id)?.name ?? id;
}
