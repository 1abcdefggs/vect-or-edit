/**
 * Whether a dictionary's vectors can be compared with the vectors of the selected embedding model.
 * The criterion is the embedding space (which model made the vectors), not the dimension: vectors of the same
 * length from different models mean nothing together. Pure functions of their arguments (no Electron, no storage),
 * shared by the main process and the tests. Design: docs/PROJECT/04_VECT_OR_EDITOR/04_10_ADR_EMBEDDING_SPACE_COMPATIBILITY.md
 */
import { REGISTRY, type EmbeddingModelEntry } from './embeddingCatalog';

/** What a dictionary header says about its vectors. Every field is optional: old dictionaries carry none of them. */
export interface KbSpaceInfo {
  spaceId?: string | null;
  model?: string | null;
  /** Length of the stored vectors (measured, not read from the header) */
  dimension: number;
}

/** The selected embedding model */
export interface ActiveModel {
  id: string;
  dimensions: number;
}

export type ExcludeReason = 'space-mismatch' | 'dim-mismatch-unknown-space' | 'dim-not-truncatable' | 'truncation-off';

export type SpaceDecision =
  | { action: 'use' }
  | { action: 'truncate-kb'; to: number }
  | { action: 'truncate-query'; to: number }
  | { action: 'exclude'; reason: ExcludeReason };

type Models = ReadonlyArray<Pick<EmbeddingModelEntry, 'id' | 'spaceId' | 'matryoshka'>>;

/** Space of a model id: the registry's spaceId, else the id itself (so only that exact id matches) */
export function spaceOfModelId(modelId: string, models: Models = REGISTRY.models): string {
  return models.find((m) => m.id === modelId)?.spaceId ?? modelId;
}

/** True when the space is registered as Matryoshka (the first N values are a valid smaller embedding) */
export function isMatryoshkaSpace(spaceId: string, models: Models = REGISTRY.models): boolean {
  return models.some((m) => m.matryoshka === true && (m.spaceId ?? m.id) === spaceId);
}

/** allowTruncation false: a dictionary that would need cutting is left out instead (the owner's switch) */
export function decideSpace(kb: KbSpaceInfo, model: ActiveModel, models: Models = REGISTRY.models, allowTruncation = true): SpaceDecision {
  const kbSpace = kb.spaceId || (kb.model ? spaceOfModelId(kb.model, models) : null);
  const modelSpace = spaceOfModelId(model.id, models);

  if (kbSpace && kbSpace !== modelSpace) return { action: 'exclude', reason: 'space-mismatch' };
  if (kb.dimension === model.dimensions) return { action: 'use' };

  // Different length: only a known, shared space can be reconciled, and only by truncation
  if (!kbSpace) return { action: 'exclude', reason: 'dim-mismatch-unknown-space' };
  if (!isMatryoshkaSpace(kbSpace, models)) return { action: 'exclude', reason: 'dim-not-truncatable' };
  if (!allowTruncation) return { action: 'exclude', reason: 'truncation-off' };
  return kb.dimension > model.dimensions
    ? { action: 'truncate-kb', to: model.dimensions }
    : { action: 'truncate-query', to: kb.dimension };
}

/** First `to` values, scaled back to length 1 (cosine / dot product stay comparable) */
export function truncateAndNormalize(vector: ArrayLike<number>, to: number): number[] {
  const out: number[] = new Array(Math.min(to, vector.length));
  let sumSq = 0;
  for (let i = 0; i < out.length; i++) {
    out[i] = vector[i];
    sumSq += out[i] * out[i];
  }
  const norm = Math.sqrt(sumSq);
  if (norm === 0) return out;
  for (let i = 0; i < out.length; i++) out[i] /= norm;
  return out;
}
