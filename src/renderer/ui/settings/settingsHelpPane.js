/**
 * The guide beside the settings: the generated document (control/tools/build_ui_help_md.mjs) of the tab that is open.
 * The settings page and the document come from the same blueprint, so the right side always explains the left.
 *
 * - The pane follows the tab: Header, Editor, Sidebar, System.
 * - When a control on the left gets focus, its row on the right is marked and scrolled into view.
 * - A click on a row on the right brings the control on the left into view.
 * - The guide is generated in Japanese and English; the pane follows the UI language (any other language shows English).
 */
import helpJa from '../../generated/ui_help.ja.json';
import helpEn from '../../generated/ui_help.en.json';
import { currentLang, t } from '../../core/i18n.js';

const TAB_AREA = {
  tabAppearance: 'Header',
  tabEditor: 'Editor',
  tabAiSearch: 'Sidebar',
  tabSystem: 'System'
};

let bound = false;
let shown = '';

const guideFor = (lang) => (lang === 'ja' ? helpJa : helpEn);

function activeTabId(modal) {
  return modal.querySelector('.settings-tab-content.active')?.id ?? '';
}

function render(modal, pane) {
  const guide = guideFor(currentLang);
  const area = guide.areas[TAB_AREA[activeTabId(modal)]];
  const visible = Boolean(area);
  // Draw again only when the tab or the language changed, not on every class change inside the settings
  const state = visible ? `${currentLang}:${activeTabId(modal)}` : 'off';
  if (state === shown) return;
  shown = state;
  pane.hidden = !visible;
  modal.classList.toggle('has-help-pane', visible);
  if (!visible) return;
  pane.setAttribute('aria-label', t('settings_help_title'));
  const about = `<details class="help-about"><summary>${t('settings_help_about')}</summary>${guide.intro}</details>`;
  pane.innerHTML = `<h2 class="help-title">${area.title}</h2>${about}${area.html}`;
  pane.scrollTop = 0;
}

/** The row of the help table that describes the control, or null. */
function rowFor(pane, element) {
  const item = element.closest('.setting-item');
  const ids = new Set([element.id, ...(item ? [...item.querySelectorAll('[id]')].map((e) => e.id) : [])].filter(Boolean));
  for (const row of pane.querySelectorAll('tr[data-control]')) {
    if (row.dataset.control.split(' ').some((id) => ids.has(id))) return row;
  }
  return null;
}

function mark(pane, row) {
  pane.querySelectorAll('tr.is-current').forEach((r) => r.classList.remove('is-current'));
  if (!row) return;
  row.classList.add('is-current');
  row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

export function initSettingsHelpPane() {
  if (bound) return;
  const modal = document.getElementById('settingsModal');
  const pane = document.getElementById('settingsHelpPane');
  const body = modal?.querySelector('.settings-modal-body');
  if (!modal || !pane || !body) return;
  bound = true;

  const refresh = () => render(modal, pane);
  refresh();

  // The tab changes by toggling the class "active": follow it
  // Only the tab panels are watched, and not the whole subtree of the page
  const panels = body.querySelectorAll('.settings-tab-content');
  const observer = new MutationObserver(refresh);
  panels.forEach((panel) => observer.observe(panel, { attributes: true, attributeFilter: ['class'] }));
  window.addEventListener('app:languageChanged', refresh);

  body.addEventListener('focusin', (e) => { if (!pane.hidden) mark(pane, rowFor(pane, e.target)); });
  body.addEventListener('pointerdown', (e) => { if (!pane.hidden && e.target instanceof Element) mark(pane, rowFor(pane, e.target)); });

  pane.addEventListener('click', (e) => {
    const row = e.target instanceof Element ? e.target.closest('tr[data-control]') : null;
    if (!row) return;
    mark(pane, row);
    for (const id of row.dataset.control.split(' ')) {
      const control = document.getElementById(id);
      if (!control) continue;
      (control.closest('.setting-item') ?? control).scrollIntoView({ block: 'center', behavior: 'smooth' });
      break;
    }
  });
}
