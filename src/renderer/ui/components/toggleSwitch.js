/**
 * Shared toggle switch: OFF on the left, ON on the right, and the knob sits on the side that is active.
 * The side that is active is also the lit word, so the state never depends on color alone.
 * Markup (see aiSetupModal.html):
 *   <span class="toggle-switch-group">
 *     <span class="toggle-switch-word" data-side="off">OFF</span>
 *     <button type="button" class="toggle-switch" role="switch" aria-labelledby="..."><span class="toggle-switch__knob"></span></button>
 *     <span class="toggle-switch-word" data-side="on">ON</span>
 *   </span>
 * The button's aria-checked is the single source of truth; everything else is drawn from it.
 */

/**
 * @param {HTMLButtonElement} button
 * @param {{ checked?: boolean, onChange?: (checked: boolean) => void }} [options]
 * @returns {{ isChecked: () => boolean, set: (checked: boolean) => void, sync: (checked: boolean) => void }}
 */
export function bindToggleSwitch(button, { checked = false, onChange = null } = {}) {
  const group = button.closest('.toggle-switch-group');

  const isChecked = () => button.getAttribute('aria-checked') === 'true';

  function render() {
    const on = isChecked();
    group?.querySelector('[data-side="on"]')?.classList.toggle('is-lit', on);
    group?.querySelector('[data-side="off"]')?.classList.toggle('is-lit', !on);
  }

  function set(next, { notify = true } = {}) {
    button.setAttribute('aria-checked', String(Boolean(next)));
    render();
    if (notify && onChange) onChange(Boolean(next));
  }

  button.addEventListener('click', () => set(!isChecked()));
  set(checked, { notify: false });
  // sync() only redraws: for a switch whose state follows other controls, so onChange does not echo back
  return { isChecked, set: (next) => set(next), sync: (next) => set(next, { notify: false }) };
}
