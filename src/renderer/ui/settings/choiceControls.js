/**
 * Shows a <select> as a switch (on/off) or as segmented buttons, so the current choice is visible at a glance.
 * The <select> stays in the page as the source of truth: callers keep reading `.value` and listening for
 * `change`, and a `.value = ...` assignment from code is reflected in the control too.
 *
 *   <select data-ui-control="switch">     two options, "on" and "off"
 *   <select data-ui-control="segmented">  a few options, one button each
 */
function renderSwitch(select, host) {
  const on = select.value === 'on';
  host.setAttribute('aria-checked', String(on));
  host.classList.toggle('is-on', on);
}

function renderSegments(select, host) {
  const options = Array.from(select.options);
  if (host.children.length !== options.length) {
    host.replaceChildren(...options.map((option) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role', 'radio');
      btn.dataset.value = option.value;
      return btn;
    }));
  }
  options.forEach((option, i) => {
    const btn = host.children[i];
    btn.dataset.value = option.value;
    btn.textContent = option.textContent.trim();
    const selected = option.value === select.value;
    btn.classList.toggle('active', selected);
    btn.setAttribute('aria-checked', String(selected));
  });
}

function choose(select, value) {
  if (select.value === value) return;
  select.value = value;
  select.dispatchEvent(new Event('input', { bubbles: true }));
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function enhance(select) {
  const valueDescriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  if (select.dataset.uiControlReady) return;
  select.dataset.uiControlReady = '1';
  const kind = select.dataset.uiControl;
  const host = document.createElement(kind === 'switch' ? 'button' : 'div');

  if (kind === 'switch') {
    host.type = 'button';
    host.className = 'ui-switch';
    host.setAttribute('role', 'switch');
    host.addEventListener('click', () => choose(select, select.value === 'on' ? 'off' : 'on'));
  } else {
    host.className = 'ui-segmented';
    host.setAttribute('role', 'radiogroup');
    host.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-value]');
      if (btn) choose(select, btn.dataset.value);
    });
  }

  const refresh = () => {
    host.title = select.title;
    if (kind === 'switch') renderSwitch(select, host);
    else renderSegments(select, host);
  };

  // Code sets `select.value = 'on'` without firing an event: follow it
  Object.defineProperty(select, 'value', {
    configurable: true,
    get() { return valueDescriptor.get.call(this); },
    set(v) { valueDescriptor.set.call(this, v); refresh(); }
  });
  select.addEventListener('change', refresh);
  // The option names are translated after the page is built
  new MutationObserver(refresh).observe(select, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['title'] });

  select.classList.add('ui-control-source');
  select.setAttribute('aria-hidden', 'true');
  select.tabIndex = -1;
  select.after(host);
  refresh();
}

/** Enhances every marked select; safe to call again. */
export function initChoiceControls(root = document) {
  root.querySelectorAll('select[data-ui-control]').forEach(enhance);
}
