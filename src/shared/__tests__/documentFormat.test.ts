import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DOCUMENT_FORMAT,
  formatOfName,
  otherFormat,
  toDocumentFormat,
  withFormatExtension
} from '../documentFormat';

describe('documentFormat', () => {
  it('defaults to Markdown and accepts only the two known values', () => {
    expect(DEFAULT_DOCUMENT_FORMAT).toBe('markdown');
    expect(toDocumentFormat('text')).toBe('text');
    expect(toDocumentFormat('markdown')).toBe('markdown');
    expect(toDocumentFormat('rtf')).toBe('markdown');
    expect(toDocumentFormat(null)).toBe('markdown');
    expect(toDocumentFormat(undefined)).toBe('markdown');
  });

  it('reads the format from the file name: .txt is Text, everything else is Markdown', () => {
    expect(formatOfName('notes.txt')).toBe('text');
    expect(formatOfName('NOTES.TXT')).toBe('text');
    expect(formatOfName('C:\\docs\\a.txt')).toBe('text');
    expect(formatOfName('notes.md')).toBe('markdown');
    expect(formatOfName('notes.markdown')).toBe('markdown');
    expect(formatOfName('notes')).toBe('markdown');
    expect(formatOfName('a.txt.md')).toBe('markdown');
    expect(formatOfName(undefined)).toBe('markdown');
  });

  it('swaps only the format extension and keeps dots inside the name', () => {
    expect(withFormatExtension('Doc-1.md', 'text')).toBe('Doc-1.txt');
    expect(withFormatExtension('Doc-1.txt', 'markdown')).toBe('Doc-1.md');
    expect(withFormatExtension('Doc-1', 'text')).toBe('Doc-1.txt');
    expect(withFormatExtension('notes v2.1.md', 'text')).toBe('notes v2.1.txt');
    expect(withFormatExtension('report.final', 'markdown')).toBe('report.final.md');
    expect(withFormatExtension('C:\\docs\\a.md', 'text')).toBe('C:\\docs\\a.txt');
  });

  it('switches to the other format', () => {
    expect(otherFormat('markdown')).toBe('text');
    expect(otherFormat('text')).toBe('markdown');
  });
});
