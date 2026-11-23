/**
 * Turns the LLM chat conversation into Markdown for saving. Pure: no DOM, no storage, no IPC.
 * entries: [{ role: 'user' | 'assistant', text: string, model?: string }] in the order they were sent or received.
 */

function pad(n) {
  return String(n).padStart(2, '0');
}

/** 20261122 for the date, 0905 for the time: the same digit order as the file name */
export function formatStamp(now = new Date()) {
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
}

export function formatTime(now = new Date()) {
  return `${pad(now.getHours())}${pad(now.getMinutes())}`;
}

/** The default file name of a saved chat, e.g. llm-chat-20261122-0905.md */
export function chatExportFileName(now = new Date()) {
  return `llm-chat-${formatStamp(now)}-${formatTime(now)}.md`;
}

/**
 * @param {Array<{role: string, text: string, model?: string}>} entries
 * @param {{ title: string, youLabel: string, assistantLabel: string, now?: Date }} labels translated by the caller
 * @returns {string} Markdown: a title and the date, then one heading per turn with its text as written
 */
export function buildChatMarkdown(entries, { title, youLabel, assistantLabel, now = new Date() }) {
  const date = `${formatStamp(now)} ${formatTime(now)}`;
  const lines = [`# ${title}`, '', date, ''];
  for (const entry of entries) {
    const heading = entry.role === 'user' ? youLabel : (entry.model || assistantLabel);
    lines.push(`## ${heading}`, '', entry.text, '');
  }
  return lines.join('\n');
}
