/**
 * The one-click format switch in the status bar: the current document goes from Markdown to Text and back.
 * What changes (language mode, extension, Preview button) lives in tabState.js and statusBarManager.js;
 * this only connects the button to it.
 */
import { toggleActiveTabFormat } from '../tabs/tabState.js';

export function initDocumentFormatControl() {
  document.getElementById('btnDocumentFormat')?.addEventListener('click', () => toggleActiveTabFormat());
}
