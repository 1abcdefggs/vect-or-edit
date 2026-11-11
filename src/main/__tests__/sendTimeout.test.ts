import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { AI_SEND_TIMEOUT_MS, abortAfterTimeout, timeoutMessage } from '../ai/sendTimeout';

afterEach(() => { vi.useRealTimers(); });

describe('abortAfterTimeout', () => {
  it('aborts the request and reports once when the limit passes', () => {
    vi.useFakeTimers();
    const request = { abort: vi.fn() };
    const onTimeout = vi.fn();
    abortAfterTimeout(request, onTimeout, 1000);
    vi.advanceTimersByTime(999);
    expect(request.abort).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(request.abort).toHaveBeenCalledTimes(1);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the request ends before the limit', () => {
    vi.useFakeTimers();
    const request = { abort: vi.fn() };
    const onTimeout = vi.fn();
    const stop = abortAfterTimeout(request, onTimeout, 1000);
    stop();
    vi.advanceTimersByTime(5000);
    expect(request.abort).not.toHaveBeenCalled();
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('uses a 10 minute default and names it in the message', () => {
    expect(AI_SEND_TIMEOUT_MS).toBe(600000);
    expect(timeoutMessage('Anthropic API')).toBe('Anthropic API: no reply within 10 minutes; the request was stopped');
  });
});

describe('aiServices sends', () => {
  // Every net.request send in aiServices.ts must carry the limit, or a stalled send keeps its AI host open
  it('puts a timer on every net.request and the limit on the Gemini client', () => {
    const text = fs.readFileSync(path.resolve(__dirname, '..', 'ai', 'aiServices.ts'), 'utf8');
    const requests = (text.match(/net\.request\(/g) || []).length;
    expect(requests).toBeGreaterThan(0);
    expect((text.match(/abortAfterTimeout\(request,/g) || []).length).toBe(requests);
    expect(text).toMatch(/new\s+GoogleGenAI\s*\(\s*\{[^)]*timeout:\s*AI_SEND_TIMEOUT_MS/);
  });
});
