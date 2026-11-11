/**
 * One time limit for every cloud LLM send.
 *
 * Replies are not streamed, so nothing arrives until the whole reply is ready: the limit must cover a long
 * reply with thinking. 10 minutes matches the default of the official Anthropic and OpenAI SDKs.
 * A send that never ends would also keep its AI host open in the egress policy (withAiEgress), so every
 * send must end by this limit at the latest.
 *
 * Public surface: AI_SEND_TIMEOUT_MS, abortAfterTimeout, timeoutMessage.
 */
export const AI_SEND_TIMEOUT_MS = 10 * 60 * 1000;

/** The part of Electron's ClientRequest this helper needs. */
export interface AbortableRequest {
  abort(): void;
}

/**
 * Aborts the request when the limit passes and calls onTimeout once.
 * Returns a function that cancels the timer; call it when the request ends or fails.
 */
export function abortAfterTimeout(request: AbortableRequest, onTimeout: () => void, ms = AI_SEND_TIMEOUT_MS): () => void {
  const timer = setTimeout(() => {
    request.abort();
    onTimeout();
  }, ms);
  return () => clearTimeout(timer);
}

/** Message for a send that hit the limit, naming the service and the limit in minutes. */
export function timeoutMessage(service: string, ms = AI_SEND_TIMEOUT_MS): string {
  return `${service}: no reply within ${Math.round(ms / 60000)} minutes; the request was stopped`;
}
