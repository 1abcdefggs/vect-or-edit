/**
 * The document format switch in the status bar. Pointing at the button lists Markdown and Text, the current one is lit,
 * and a click on either chooses it (the old one-click toggle could not say which format it would switch to).
 * What changes (language mode, extension, Preview button) lives in tabState.js and statusBarManager.js;
 * this only connects the items to it.
 */
import { getActiveTab, setTabFormat } from '../tabs/tabState.js';

export function initDocumentFormatControl() {
  document.querySelectorAll('.format-switch__item').forEach((item) => {
    item.addEventListener('click', () => {
      const tab = getActiveTab();
      if (tab) setTabFormat(tab, item.dataset.format);
      // The menu closes by itself once the pointer leaves; a click on an item also drops the focus that keeps it open
      item.blur();
    });
  });
}

/** Lights the item of the current format. Called whenever the status bar updates. */
export function syncFormatMenu(isText) {
  document.querySelectorAll('.format-switch__item').forEach((item) => {
    const on = item.dataset.format === (isText ? 'text' : 'markdown');
    item.setAttribute('aria-checked', String(on));
    item.classList.toggle('is-current', on);
  });
}
