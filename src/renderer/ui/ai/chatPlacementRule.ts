/**
 * Where the AI chat area sits: below the editor, or as a tab of the right sidebar.
 *
 * One remembered value (owner decision 2026-11-22): the settings row, the right-click items of the AI button and the
 * move button in the chat header all write it, so they cannot disagree. First run: below the editor.
 *
 * Public surface: ChatPlacement, DEFAULT_CHAT_PLACEMENT, normalizeChatPlacement, otherChatPlacement.
 */
export type ChatPlacement = 'below' | 'sidebar';

export const DEFAULT_CHAT_PLACEMENT: ChatPlacement = 'below';

/** A stored value that is not one of the two places (empty, damaged, from a later version) means the default. */
export function normalizeChatPlacement(value: unknown): ChatPlacement {
  return value === 'sidebar' || value === 'below' ? value : DEFAULT_CHAT_PLACEMENT;
}

export function otherChatPlacement(placement: ChatPlacement): ChatPlacement {
  return placement === 'sidebar' ? 'below' : 'sidebar';
}
