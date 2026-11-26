/**
 * aiAccess.ts - the one gate in front of every AI feature.
 *
 * A function that calls a cloud model, or runs the embedding model, asks here first and returns
 * without calling when the answer is false. Do not read the switches in aiStateManager directly.
 */
import { aiManager } from './aiStateManager.js';

export interface KnowledgeSources {
  /** Dictionary lookup always runs, whatever the AI switches say */
  dictionary: true;
  /** Vector search with the local embedding model */
  vector: boolean;
  /** Suggestions from the cloud LLM (stands in for the embedding model while that is off) */
  llm: boolean;
}

/** True while the LLM switch is ON and a provider with a key is configured. */
export function canUseLlm(): boolean {
  const state = aiManager.getState();
  return state.llm && state.llmConfigured;
}

/** True while the Embedding switch is ON and the local model is ready. */
export function canUseEmbedding(): boolean {
  const state = aiManager.getState();
  return state.embed && state.embedConfigured;
}

/** Why "Search Knowledge" cannot run, in the order the user fixes it; null when it can. */
export type KnowledgeSearchBlocker = 'embed_off' | 'no_model' | 'no_dictionary';

/** Pure rule: the Embedding switch is ON, the model is ready and the Knowledge holds a dictionary. */
export function knowledgeSearchBlockerFor(input: { embed: boolean; embedConfigured: boolean; hasDictionary: boolean }): KnowledgeSearchBlocker | null {
  if (!input.embed) return 'embed_off';
  if (!input.embedConfigured) return 'no_model';
  if (!input.hasDictionary) return 'no_dictionary';
  return null;
}

/** The blocker right now (the caller says whether a dictionary is loaded). */
export function knowledgeSearchBlocker(hasDictionary: boolean): KnowledgeSearchBlocker | null {
  const state = aiManager.getState();
  return knowledgeSearchBlockerFor({ embed: state.embed, embedConfigured: state.embedConfigured, hasDictionary });
}

/** Why "AI Chat & Rewrite" cannot run; null when it can. The AI chat switch comes first, then the provider and key. */
export type LlmChatBlocker = 'llm_off' | 'no_provider';

/** Pure rule: the AI chat (LLM) switch is ON and a provider with a key is configured. */
export function llmChatBlockerFor(input: { llm: boolean; llmConfigured: boolean }): LlmChatBlocker | null {
  if (!input.llm) return 'llm_off';
  if (!input.llmConfigured) return 'no_provider';
  return null;
}

/** The AI chat blocker right now. */
export function llmChatBlocker(): LlmChatBlocker | null {
  const state = aiManager.getState();
  return llmChatBlockerFor({ llm: state.llm, llmConfigured: state.llmConfigured });
}

/** Which sources may feed the Knowledge results right now. */
export function knowledgeSources(): KnowledgeSources {
  return { dictionary: true, vector: canUseEmbedding(), llm: canUseLlm() };
}

export const aiAccess = { canUseLlm, canUseEmbedding, knowledgeSources, knowledgeSearchBlocker, llmChatBlocker };
