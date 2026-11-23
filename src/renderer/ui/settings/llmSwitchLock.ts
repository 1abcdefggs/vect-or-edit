/**
 * Why the "Use AI chat" switch on the settings page cannot be turned on yet.
 *
 * The switch needs the same condition the window enforces for the title-bar button: a cloud provider
 * is chosen and its API key is stored. The reason names the first missing step, so the text says what to do.
 * Returns the locale key of the reason, or null when the switch is usable.
 */
export const LLM_SWITCH_REASON_PROVIDER = 'setting_master_ai_reason_provider';
export const LLM_SWITCH_REASON_KEY = 'setting_master_ai_reason_key';

const CLOUD_PROVIDERS = ['gemini', 'openai', 'claude'];

export function llmSwitchReasonKey(provider: string | null | undefined, configured: boolean): string | null {
  if (configured) return null;
  if (!provider || !CLOUD_PROVIDERS.includes(provider)) return LLM_SWITCH_REASON_PROVIDER;
  return LLM_SWITCH_REASON_KEY;
}

/** Short text beside the switch for each reason (the full reason stays in the text block), so the missing step is visible at the switch. */
const LLM_SWITCH_NOTE_KEYS: Record<string, string> = {
  [LLM_SWITCH_REASON_PROVIDER]: 'setting_master_ai_note_provider',
  [LLM_SWITCH_REASON_KEY]: 'setting_master_ai_note_key'
};

export function llmSwitchNoteKey(reasonKey: string | null): string | null {
  return reasonKey ? (LLM_SWITCH_NOTE_KEYS[reasonKey] ?? null) : null;
}

/**
 * Where to land on the settings page when the AI chat needs setting up: the key field of the chosen provider,
 * or the provider choice when none is chosen. Ids of settingsModal.html.
 */
const LLM_KEY_FIELD_IDS: Record<string, string> = {
  gemini: 'modalGeminiKeyInput',
  openai: 'modalOpenAiKeyInput',
  claude: 'modalClaudeKeyInput'
};
export const LLM_PROVIDER_CHOICE_ID = 'modalAiProviderSelect';

export function llmSetupTargetId(provider: string | null | undefined): string {
  return (provider && LLM_KEY_FIELD_IDS[provider]) || LLM_PROVIDER_CHOICE_ID;
}
