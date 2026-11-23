import { describe, expect, it } from 'vitest';
import { GEMINI_QUICK_LIMIT, quickModels } from '../modelQuickList';
import { CLAUDE_CHAT_MODELS, OPENAI_CHAT_MODELS } from '../../../../shared/chatModels';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const gemini = (name: string, displayName = '') => ({ name, displayName, canGenerate: true });

describe('quickModels', () => {
  it('lists the fixed models of OpenAI and Claude and marks the one in use', () => {
    const openai = quickModels('openai', 'gpt-4o', []);
    expect(openai.map((m) => m.id)).toEqual(OPENAI_CHAT_MODELS.map((m) => m.id));
    expect(openai.find((m) => m.current)?.id).toBe('gpt-4o');
    const claude = quickModels('claude', 'claude-haiku-5-5', []);
    expect(claude.map((m) => m.id)).toEqual(CLAUDE_CHAT_MODELS.map((m) => m.id));
    expect(claude.filter((m) => m.current)).toHaveLength(1);
  });

  it('puts a model in use that is not in the list at the top, so the choice is never hidden', () => {
    const list = quickModels('claude', 'claude-3-old', []);
    expect(list[0]).toEqual({ id: 'claude-3-old', label: 'claude-3-old', current: true });
    expect(list).toHaveLength(CLAUDE_CHAT_MODELS.length + 1);
  });

  it('lists nothing for Gemini until a list was fetched, but keeps the model in use', () => {
    expect(quickModels('gemini', '', null)).toEqual([]);
    expect(quickModels('gemini', 'gemini-2.5-flash', undefined)).toEqual([{ id: 'gemini-2.5-flash', label: 'gemini-2.5-flash', current: true }]);
  });

  it('takes only text models of the fetched Gemini list, limited in number, and skips ones that cannot generate', () => {
    const fetched = [
      gemini('gemini-2.5-flash', 'Gemini 2.5 Flash'),
      gemini('gemini-2.5-pro', 'Gemini 2.5 Pro'),
      { name: 'gemini-embedding-001', displayName: 'Embedding', canGenerate: false },
      ...Array.from({ length: 12 }, (_, i) => gemini(`gemini-1.${i}-flash`, `Gemini 1.${i} Flash`))
    ];
    const list = quickModels('gemini', 'gemini-2.5-flash', fetched);
    expect(list.length).toBeLessThanOrEqual(GEMINI_QUICK_LIMIT + 1);
    expect(list.some((m) => m.id === 'gemini-embedding-001')).toBe(false);
    expect(list.filter((m) => m.current)).toHaveLength(1);
  });

  it('gives no models for an unknown provider', () => {
    expect(quickModels('none', '', [])).toEqual([]);
  });
});

describe('the settings page options', () => {
  const html = readFileSync(resolve(__dirname, '../../../components/settingsModal.html'), 'utf8');
  const optionIds = (selectId: string) => {
    const block = html.match(new RegExp(`<select id="${selectId}"[\\s\\S]*?</select>`))?.[0] ?? '';
    return [...block.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]);
  };

  it('offers the same OpenAI and Claude models as the quick menu', () => {
    expect(optionIds('modalOpenAiModelSelect')).toEqual(OPENAI_CHAT_MODELS.map((m) => m.id));
    expect(optionIds('modalClaudeModelSelect')).toEqual(CLAUDE_CHAT_MODELS.map((m) => m.id));
  });
});
