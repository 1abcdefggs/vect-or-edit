/**
 * The document language switch in the status bar. Pointing at the button lists Auto, Japanese and English;
 * the choice belongs to the active tab (tab.manualLanguage, '' = Auto) and is not saved with the file.
 * What the language changes lives in options/documentLanguageSync.js; this only connects the items to it
 * and shows the language the document has now.
 */
import { getActiveTab } from '../tabs/tabState.js';
import { editorEvents } from '../core/editorEvents.js';
import { t } from '../../core/i18n.js';
import { setManualLanguageProvider, requestLanguageCheck } from '../options/documentLanguageSync.js';

/** Lights the item of the current choice and writes the language (and "auto") on the button. */
export function renderLanguageControl({ language, manual }) {
  const choice = manual || 'auto';
  document.querySelectorAll('.format-switch__item[data-language]').forEach((item) => {
    const on = item.dataset.language === choice;
    item.setAttribute('aria-checked', String(on));
    item.classList.toggle('is-current', on);
  });
  const label = document.getElementById('statusLanguageLabel');
  if (!label) return;
  const code = String(language || '').toUpperCase();
  label.textContent = manual ? code : t('doc_lang_label_auto', { code });
}

export function initDocumentLanguageControl() {
  setManualLanguageProvider(() => getActiveTab()?.manualLanguage || '');

  document.querySelectorAll('.format-switch__item[data-language]').forEach((item) => {
    item.addEventListener('click', () => {
      const tab = getActiveTab();
      if (tab) tab.manualLanguage = item.dataset.language === 'auto' ? '' : item.dataset.language;
      requestLanguageCheck();
      item.blur();
    });
  });

  editorEvents.on('onDocumentLanguageChanged', renderLanguageControl);
  window.addEventListener('app:languageChanged', () => requestLanguageCheck());
  requestLanguageCheck();
}
