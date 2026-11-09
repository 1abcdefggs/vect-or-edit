/**
 * Shared markup of the settings page: card headings, the frame of a row and the text of a row (label and description).
 * settingsModal.html keeps one placeholder per heading or row; renderStaticSettingsText fills them at startup.
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

/** The classes of a row frame. variant "stack" puts the control under the heading. */
export function settingRowClasses(variant) {
  return variant === 'stack' ? ['setting-item', 'setting-item--stack'] : ['setting-item'];
}

/** Gives every row placeholder its frame classes. Existing classes (e.g. settings-subpanel) stay. */
export function renderSettingRows(root = document) {
  root.querySelectorAll('[data-setting-row]').forEach((el) => {
    el.classList.add(...settingRowClasses(el.dataset.settingRow));
  });
}

/** Fills every placeholder under root. Runs at startup, after the locale is loaded. */
export function renderStaticSettingsText(root = document) {
  renderSettingRows(root);
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
  nameRowControls(root);
}

let labelSeq = 0;
/** The id of a row's label, given one when it has none. Controls point at it with aria-labelledby. */
export function rowLabelId(label) {
  if (!label.id) label.id = `setting-label-${++labelSeq}`;
  return label.id;
}

/**
 * Names the inputs of a row (number, password, checkbox, text) after the row's label, so a screen reader says what
 * they set. Controls that already have a name (aria-label or aria-labelledby) are left as they are.
 */
export function nameRowControls(root = document) {
  root.querySelectorAll('[data-setting-row]').forEach((row) => {
    const label = row.querySelector('.setting-label');
    if (!label) return;
    row.querySelectorAll('input:not([type="hidden"]), textarea').forEach((el) => {
      if (el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')) return;
      el.setAttribute('aria-labelledby', rowLabelId(label));
    });
  });
}
