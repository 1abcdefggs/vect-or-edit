import { describe, expect, it } from 'vitest';
import { LLM_PROVIDER_CHOICE_ID, LLM_SWITCH_REASON_KEY, LLM_SWITCH_REASON_PROVIDER, llmSetupTargetId, llmSwitchNoteKey, llmSwitchReasonKey } from '../llmSwitchLock';

describe('llmSwitchReasonKey', () => {
  it('has no reason once the provider is chosen and its key is stored', () => {
    expect(llmSwitchReasonKey('gemini', true)).toBeNull();
    expect(llmSwitchReasonKey('claude', true)).toBeNull();
  });

  it('asks for a provider first when none is chosen', () => {
    expect(llmSwitchReasonKey('none', false)).toBe(LLM_SWITCH_REASON_PROVIDER);
    expect(llmSwitchReasonKey('', false)).toBe(LLM_SWITCH_REASON_PROVIDER);
    expect(llmSwitchReasonKey(null, false)).toBe(LLM_SWITCH_REASON_PROVIDER);
    expect(llmSwitchReasonKey('local', false)).toBe(LLM_SWITCH_REASON_PROVIDER);
  });

  it('asks for the key when a provider is chosen but its key is not stored', () => {
    expect(llmSwitchReasonKey('openai', false)).toBe(LLM_SWITCH_REASON_KEY);
  });
});

describe("llmSwitchNoteKey", () => {
  it("has a short note for each reason and none when the switch is usable", () => {
    expect(llmSwitchNoteKey(LLM_SWITCH_REASON_PROVIDER)).toBe("setting_master_ai_note_provider");
    expect(llmSwitchNoteKey(LLM_SWITCH_REASON_KEY)).toBe("setting_master_ai_note_key");
    expect(llmSwitchNoteKey(null)).toBeNull();
  });
});

describe("llmSetupTargetId", () => {
  it("lands on the key field of the chosen provider", () => {
    expect(llmSetupTargetId("gemini")).toBe("modalGeminiKeyInput");
    expect(llmSetupTargetId("openai")).toBe("modalOpenAiKeyInput");
    expect(llmSetupTargetId("claude")).toBe("modalClaudeKeyInput");
  });

  it("lands on the provider choice when no provider is chosen", () => {
    expect(llmSetupTargetId("none")).toBe(LLM_PROVIDER_CHOICE_ID);
    expect(llmSetupTargetId(null)).toBe(LLM_PROVIDER_CHOICE_ID);
  });
});
