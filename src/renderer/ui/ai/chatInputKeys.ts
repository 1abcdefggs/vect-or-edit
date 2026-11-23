/**
 * Key rules of the chat input box.
 *
 * Enter sends, Shift+Enter makes a new line. While an input method is converting text (Japanese, Chinese,
 * Korean), Enter confirms the conversion and must not send: the keydown then has isComposing set, and some
 * engines report keyCode 229 instead.
 */
export interface ChatKeyEvent {
  key: string;
  shiftKey: boolean;
  isComposing?: boolean;
  keyCode?: number;
}

const IME_PROCESS_KEY_CODE = 229;

export function shouldSendOnKey(event: ChatKeyEvent): boolean {
  if (event.key !== 'Enter' || event.shiftKey) return false;
  if (event.isComposing || event.keyCode === IME_PROCESS_KEY_CODE) return false;
  return true;
}
