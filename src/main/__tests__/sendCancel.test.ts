import { describe, expect, it } from 'vitest';
import { beginSend, cancelSend } from '../ai/sendCancel';

describe('sendCancel', () => {
  it('aborts the signal of a registered send once', () => {
    const send = beginSend('a');
    expect(send.signal?.aborted).toBe(false);
    expect(cancelSend('a')).toBe(true);
    expect(send.signal?.aborted).toBe(true);
    expect(cancelSend('a')).toBe(false);
  });

  it('ignores an id that is not registered or not a string', () => {
    expect(cancelSend('nope')).toBe(false);
    expect(cancelSend(42)).toBe(false);
    expect(cancelSend(undefined)).toBe(false);
  });

  it('gives no signal to a send without an id, so internal callers cannot be cancelled', () => {
    const send = beginSend(undefined);
    expect(send.signal).toBeUndefined();
    expect(() => send.end()).not.toThrow();
  });

  it('releases the id when the send ends', () => {
    const send = beginSend('b');
    send.end();
    expect(cancelSend('b')).toBe(false);
    expect(send.signal?.aborted).toBe(false);
  });

  it('keeps a newer send that reuses the id when an older one ends late', () => {
    const first = beginSend('c');
    const second = beginSend('c');
    first.end();
    expect(cancelSend('c')).toBe(true);
    expect(second.signal?.aborted).toBe(true);
  });

  it('remembers a cancel that arrives before the send registers', () => {
    expect(cancelSend('early')).toBe(false);
    const send = beginSend('early');
    expect(send.signal?.aborted).toBe(true);
    // the remembered cancel is used once
    const again = beginSend('early');
    expect(again.signal?.aborted).toBe(false);
  });

  it('does not remember a cancel for an id that is empty or too long', () => {
    expect(cancelSend('')).toBe(false);
    expect(beginSend('').signal).toBeUndefined();
    expect(cancelSend('y'.repeat(101))).toBe(false);
  });

  it('refuses an id that is empty or too long', () => {
    expect(beginSend('').signal).toBeUndefined();
    expect(beginSend('x'.repeat(101)).signal).toBeUndefined();
  });
});
