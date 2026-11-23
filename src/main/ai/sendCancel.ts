/**
 * Lets the chat window stop a cloud LLM send that is still waiting for its reply.
 *
 * A send registers under an id given by the window; cancelSend(id) aborts it. The abort signal is shared by
 * every provider: the Gemini SDK takes it as abortSignal, the net.request based providers abort their request
 * from it. A cancel that arrives before the send has registered (the key is still being read) is remembered for
 * a short time, so a quick Stop is not lost; a cancel for a send that already ended is ignored (the id is remembered as
 * finished for the same time, so a late Stop cannot abort a later send that reuses the id).
 *
 * Public surface: beginSend, cancelSend, CANCELLED_MESSAGE.
 */
export const CANCELLED_MESSAGE = 'Cancelled by the user';

const MAX_ID_LENGTH = 100;
const EARLY_CANCEL_TTL_MS = 30_000;
const EARLY_CANCEL_MAX = 50;
const active = new Map<string, AbortController>();
const earlyCancelled = new Map<string, number>();
const finished = new Map<string, number>();

function pruneRecent(list: Map<string, number>, now: number): void {
  for (const [id, at] of list) {
    if (now - at > EARLY_CANCEL_TTL_MS) list.delete(id);
  }
  // A misbehaving window cannot grow the list without limit: the oldest entries go first
  while (list.size > EARLY_CANCEL_MAX) {
    const oldest = list.keys().next().value;
    if (oldest === undefined) break;
    list.delete(oldest);
  }
}

export interface SendHandle {
  signal: AbortSignal | undefined;
  /** Call when the send ends for any reason, so the id is released. */
  end: () => void;
}

/** Registers a send. Without a usable id (internal callers) the send cannot be cancelled and has no signal. */
export function beginSend(requestId?: unknown): SendHandle {
  if (typeof requestId !== 'string' || requestId.length === 0 || requestId.length > MAX_ID_LENGTH) {
    return { signal: undefined, end: () => undefined };
  }
  const controller = new AbortController();
  active.set(requestId, controller);
  finished.delete(requestId);
  // The window asked to stop before this send registered
  if (earlyCancelled.delete(requestId)) controller.abort();
  return {
    signal: controller.signal,
    end: () => {
      // Another send may have reused the id; release only our own controller
      if (active.get(requestId) !== controller) return;
      active.delete(requestId);
      const now = Date.now();
      finished.set(requestId, now);
      pruneRecent(finished, now);
    }
  };
}

/** Aborts the send registered under the id. Returns true when there was one. */
export function cancelSend(requestId: unknown): boolean {
  if (typeof requestId !== 'string') return false;
  const controller = active.get(requestId);
  if (!controller) {
    if (requestId.length > 0 && requestId.length <= MAX_ID_LENGTH && !finished.has(requestId)) {
      const now = Date.now();
      earlyCancelled.set(requestId, now);
      pruneRecent(earlyCancelled, now);
    }
    return false;
  }
  active.delete(requestId);
  controller.abort();
  return true;
}
