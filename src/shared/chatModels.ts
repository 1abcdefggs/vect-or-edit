/**
 * The models offered for the OpenAI and Claude chat. They are fixed lists (Gemini's list comes from its API).
 * One place for the settings page and the quick model menu of the chat header: the options of the settings page
 * must carry the same ids (a test compares them), so the two cannot drift apart.
 *
 * Public surface: ChatModelOption, OPENAI_CHAT_MODELS, CLAUDE_CHAT_MODELS, CHAT_MODELS_CHECKED_ON, formatEnglishDate.
 */
export interface ChatModelOption {
  id: string;
  /** The name shown in the menu; a product name, so it is not translated */
  label: string;
}

export const OPENAI_CHAT_MODELS: readonly ChatModelOption[] = [
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { id: 'gpt-4o', label: 'GPT-4o' }
];

export const CLAUDE_CHAT_MODELS: readonly ChatModelOption[] = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5' }
];

/** The day the fixed lists above were last checked against the providers' documentation (ISO date, YYYY-MM-DD). */
export const CHAT_MODELS_CHECKED_ON = "2026-11-23";

/** An ISO date as an English date, e.g. "Nov 23, 2026". The text stays English in every UI language. */
export function formatEnglishDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, d)));
}
