import { describe, it, expect } from 'vitest';
import { buildChatMarkdown, chatExportFileName } from '../ui/ai/chatExport.js';

const labels = { title: 'LLM chat', youLabel: 'You', assistantLabel: 'AI Assistant', now: new Date(2026, 10, 22, 9, 5) };

describe('chatExportFileName', () => {
  it('uses the date and the time in digit order, e.g. llm-chat-20261122-0905.md', () => {
    expect(chatExportFileName(new Date(2026, 10, 22, 9, 5))).toBe('llm-chat-20261122-0905.md');
  });
});

describe('buildChatMarkdown', () => {
  it('writes the title, the date and one heading per turn in order', () => {
    const md = buildChatMarkdown(
      [
        { role: 'user', text: 'Hello' },
        { role: 'assistant', text: 'Hi there', model: 'gemini-2.0' }
      ],
      labels
    );
    expect(md.split('\n')).toEqual([
      '# LLM chat',
      '',
      '20261122 0905',
      '',
      '## You',
      '',
      'Hello',
      '',
      '## gemini-2.0',
      '',
      'Hi there',
      ''
    ]);
  });

  it('uses the assistant label when the reply has no model name', () => {
    const md = buildChatMarkdown([{ role: 'assistant', text: 'x' }], labels);
    expect(md).toContain('## AI Assistant');
  });

  it('keeps the text as written, Markdown characters included', () => {
    const md = buildChatMarkdown([{ role: 'user', text: '# not a heading\n- kept' }], labels);
    expect(md).toContain('# not a heading\n- kept');
  });

  it('gives only the header for an empty conversation (the caller checks for emptiness first)', () => {
    expect(buildChatMarkdown([], labels).split('\n').filter((l) => l.startsWith('## '))).toEqual([]);
  });
});
