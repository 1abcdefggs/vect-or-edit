/**
 * The two document formats and how a file name maps to one of them.
 * A document is either Markdown (.md, headings and lists written with symbols, can be shown as a rendered preview)
 * or plain Text (.txt). The format is carried by the file extension, so a saved file always says which one it is.
 * This file has no editor or Electron code, so the main process, the renderer and the tests can all use it.
 */
export type DocumentFormat = 'markdown' | 'text';

export const DOCUMENT_FORMATS: Record<DocumentFormat, { extension: string; languageId: string }> = {
  markdown: { extension: '.md', languageId: 'markdown' },
  text: { extension: '.txt', languageId: 'plaintext' }
};

export const DEFAULT_DOCUMENT_FORMAT: DocumentFormat = 'markdown';

/** Narrows any stored value to a known format; anything else becomes the default (Markdown). */
export function toDocumentFormat(value: unknown): DocumentFormat {
  return value === 'text' ? 'text' : DEFAULT_DOCUMENT_FORMAT;
}

/** The format a file name implies: ".txt" is Text; everything else, including no extension, is Markdown. */
export function formatOfName(name: unknown): DocumentFormat {
  return typeof name === 'string' && /\.txt$/i.test(name.trim()) ? 'text' : 'markdown';
}

/** The base name with the extension of `format`: "Doc-1.md" + text gives "Doc-1.txt"; a name without one gets it added. */
export function withFormatExtension(name: string, format: DocumentFormat): string {
  const base = String(name).replace(/\.(md|markdown|txt)$/i, '');
  return base + DOCUMENT_FORMATS[format].extension;
}

/** The other format, for the one-click switch. */
export function otherFormat(format: DocumentFormat): DocumentFormat {
  return format === 'markdown' ? 'text' : 'markdown';
}
