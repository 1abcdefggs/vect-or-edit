/**
 * Markup of one toggle switch group (OFF | knob | ON), see toggleSwitch.js for the behaviour.
 * The group element stays in the HTML with data-toggle-switch and its id, label and tooltip key;
 * renderToggleSwitches fills it at startup. The string builder is pure, so it can be checked without a window.
 */

export function toggleSwitchMarkup({ id, labelledBy, tipKey }) {
  return '<span class="toggle-switch-word" data-side="off" aria-hidden="true">OFF</span>'
    + `<button type="button" id="${id}" class="toggle-switch" role="switch" aria-checked="true" aria-labelledby="${labelledBy}" data-i18n-title="${tipKey}"><span class="toggle-switch__knob"></span></button>`
    + '<span class="toggle-switch-word" data-side="on" aria-hidden="true">ON</span>';
}

/** Fills every toggle group under root. Runs at startup, before the locale is applied to the new tooltips. */
export function renderToggleSwitches(root = document) {
  root.querySelectorAll('[data-toggle-switch]').forEach((el) => {
    el.innerHTML = toggleSwitchMarkup({ id: el.dataset.id, labelledBy: el.dataset.labelledby, tipKey: el.dataset.tip });
  });
}
