import { describe, expect, it } from 'vitest';
import { parseModelIds } from '../ai/aiServices';

describe('parseModelIds (OpenAI and Claude /v1/models bodies)', () => {
  it('reads the ids, sorted and without duplicates', () => {
    const body = { data: [{ id: 'gpt-b' }, { id: 'gpt-a' }, { id: 'gpt-a' }] };
    expect(parseModelIds(body)).toEqual(['gpt-a', 'gpt-b']);
  });

  it('gives an empty list for a body without data', () => {
    expect(parseModelIds({})).toEqual([]);
    expect(parseModelIds(null)).toEqual([]);
    expect(parseModelIds({ data: 'nope' })).toEqual([]);
  });

  it('drops items without a usable id', () => {
    const body = { data: [{ id: '' }, { id: 5 }, {}, { id: 'x'.repeat(201) }, { id: 'claude-ok' }] };
    expect(parseModelIds(body)).toEqual(['claude-ok']);
  });
});
