/**
 * Shared markup of the settings page: card headings and the text of a row (label and description).
 * settingsModal.html keeps one placeholder per heading or row text; renderStaticSettingsText fills them at startup.
 * The string builders are pure (no DOM), so they can be checked without a window.
 */

const escapeAttr = (value) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/** The icon and the title of a card heading (the h4 keeps its own element). */
export function cardHeadingMarkup({ icon, key, text }) {
  return `<span class="material-symbols-outlined">${icon}</span><span data-i18n="${key}">${text}</span>`;
}

/** The label and the description inside a row's text block. */
export function settingTextMarkup({ labelKey, labelText, descKey, descText }) {
  return `<div class="setting-label" data-i18n="${labelKey}">${labelText}</div>`
    + `<div class="setting-desc" data-i18n="${descKey}">${descText}</div>`;
}

/** Placeholder attributes for a card heading (used in settingsModal.html). */
export function cardHeadingAttributes({ icon, key, text }) {
  return ` data-card-heading data-icon="${escapeAttr(icon)}" data-key="${escapeAttr(key)}" data-text="${escapeAttr(text)}"`;
}

/** Placeholder attributes for a row's text block (used in settingsModal.html). */
export function settingTextAttributes({ labelKey, labelText, descKey, descText }) {
  return ` data-setting-text data-label-key="${escapeAttr(labelKey)}" data-label-text="${escapeAttr(labelText)}"`
    + ` data-desc-key="${escapeAttr(descKey)}" data-desc-text="${escapeAttr(descText)}"`;
}

/** Fills every placeholder under root. Runs at startup, after the locale is loaded. */
export function renderStaticSettingsText(root = document) {
  root.querySelectorAll('[data-card-heading]').forEach((el) => {
    el.innerHTML = cardHeadingMarkup({ icon: el.dataset.icon, key: el.dataset.key, text: el.dataset.text });
  });
  root.querySelectorAll('[data-setting-text]').forEach((el) => {
    el.innerHTML = settingTextMarkup({
      labelKey: el.dataset.labelKey,
      labelText: el.dataset.labelText,
      descKey: el.dataset.descKey,
      descText: el.dataset.descText
    });
  });
}
