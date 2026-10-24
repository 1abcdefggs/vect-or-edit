import { describe, expect, it } from 'vitest';
import { migrateLlmProvider } from '../llmProviderMigration';

function fakeStorage(initial: Record<string, string>) {
  const data = { ...initial };
  return {
    data,
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => {
      data[key] = value;
    }
  };
}

describe('llm provider migration', () => {
  it('keeps a cloud provider the user had picked', () => {
    const storage = fakeStorage({ ai_provider: 'openai' });
    migrateLlmProvider(storage);
    expect(storage.data.llm_provider).toBe('openai');
  });

  it('starts with none when the old value was local or missing', () => {
    const local = fakeStorage({ ai_provider: 'local' });
    migrateLlmProvider(local);
    expect(local.data.llm_provider).toBe('none');

    const empty = fakeStorage({});
    migrateLlmProvider(empty);
    expect(empty.data.llm_provider).toBe('none');
  });

  it('never changes the search generator key', () => {
    const storage = fakeStorage({ ai_provider: 'gemini' });
    migrateLlmProvider(storage);
    expect(storage.data.ai_provider).toBe('gemini');
  });

  it('runs once: a stored llm_provider is not overwritten', () => {
    const storage = fakeStorage({ ai_provider: 'gemini', llm_provider: 'none' });
    migrateLlmProvider(storage);
    expect(storage.data.llm_provider).toBe('none');
  });
});
