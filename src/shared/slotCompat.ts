/**
 * The compatibility state of every knowledge file of one load, decided in one place (design doc 15.3 item 3 and 15.4).
 * The state of a file depends on its own facts, the selected model, the truncation switch, and on the other files of the
 * same load (a shorter file cannot share the index with files at the model length). First match wins:
 *   1 empty (no vectors)   2 own lengths differ (dim-inconsistent)   3 no model announced (unchecked, or left out
 *   when the length differs from the first measured one)   4 other space   5 ok / unverified   6 approximate
 *   7 left out for the length (not truncatable, truncation off, no record, shorter than the files at the model length).
 * Unreadable files never reach this function: they are marked where they are read. Pure; shared with the tests.
 */
import { decideSpace, type ActiveModel, type KbSpaceInfo } from './embeddingSpace';
import { REGISTRY } from './embeddingCatalog';

export type CompatState = 'ok' | 'approximate' | 'unverified' | 'unchecked' | 'excluded';
export type CompatReason =
  | 'space-mismatch' | 'dim-mismatch-unknown-space' | 'dim-not-truncatable' | 'dim-mismatch-mixed' | 'truncation-off'
  | 'dim-inconsistent' | 'no-vectors';

/** What is known about one readable file */
export interface SlotFacts {
  header: { spaceId?: string; model?: string };
  /** Length of its first vector, 0 when it has none */
  dimension: number;
  /** True when its own vectors differ in length */
  innerMismatch: boolean;
}

export interface SlotVerdict {
  compat: { state: CompatState; reason?: CompatReason };
  /** True when its vectors enter the index */
  inIndex: boolean;
  /** Cut the file's vectors to this length (and normalise) before they enter the index */
  cutTo?: number;
}

export interface SlotsDecision {
  verdicts: SlotVerdict[];
  /** The query vector is cut to this length (every file in use is shorter than the model) */
  queryCutTo: number | null;
}

type Models = Parameters<typeof decideSpace>[2];

export function decideSlots(slots: SlotFacts[], model: ActiveModel | null, allowTruncation = true, models: Models = REGISTRY.models): SlotsDecision {
  const verdicts: SlotVerdict[] = slots.map(() => ({ compat: { state: 'unchecked' }, inIndex: false }));
  const out = (i: number, state: CompatState, inIndex: boolean, reason?: CompatReason, cutTo?: number) => {
    verdicts[i] = { compat: reason ? { state, reason } : { state }, inIndex, ...(cutTo ? { cutTo } : {}) };
  };

  // 1 and 2: facts of the file alone
  const open: number[] = [];
  slots.forEach((s, i) => {
    if (s.dimension === 0 && !s.innerMismatch) out(i, 'excluded', false, 'no-vectors');
    else if (s.innerMismatch) out(i, 'excluded', false, 'dim-inconsistent');
    else open.push(i);
  });

  // 3: no model announced: one index holds one vector length, so the first measured length wins
  if (!model) {
    const first = open.length ? slots[open[0]].dimension : 0;
    for (const i of open) {
      if (slots[i].dimension !== first) out(i, 'excluded', false, 'dim-mismatch-mixed');
      else out(i, 'unchecked', true);
    }
    return { verdicts, queryCutTo: null };
  }

  // 4 to 7: the model's space and length
  const decided = open.map((i) => ({ i, d: decideSpace({ ...slots[i].header, dimension: slots[i].dimension } as KbSpaceInfo, model, models, allowTruncation) }));
  const queryCuts = decided.filter((x) => x.d.action === 'truncate-query').map((x) => (x.d as { to: number }).to);
  const keepsModelLength = decided.some((x) => x.d.action === 'use' || x.d.action === 'truncate-kb');
  const target = !keepsModelLength && queryCuts.length > 0 ? Math.min(...queryCuts) : model.dimensions;
  for (const { i, d } of decided) {
    const s = slots[i];
    const named = Boolean(s.header.spaceId || s.header.model);
    if (d.action === 'exclude') out(i, 'excluded', false, d.reason);
    else if (d.action === 'truncate-query' && target === model.dimensions) out(i, 'excluded', false, 'dim-mismatch-mixed');
    else if (s.dimension !== target) out(i, 'approximate', true, undefined, target);
    else out(i, named ? (target < model.dimensions ? 'approximate' : 'ok') : 'unverified', true);
  }
  return { verdicts, queryCutTo: target < model.dimensions ? target : null };
}
