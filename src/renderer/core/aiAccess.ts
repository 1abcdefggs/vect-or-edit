/**
 * aiAccess.ts - the one gate in front of every AI feature (ADR-11).
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

/** Which sources may feed the Knowledge results right now (the table in ADR-11 section 2.2). */
export function knowledgeSources(): KnowledgeSources {
  return { dictionary: true, vector: canUseEmbedding(), llm: canUseLlm() };
}

export const aiAccess = { canUseLlm, canUseEmbedding, knowledgeSources };
