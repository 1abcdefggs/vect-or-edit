/**
 * The guide beside the settings: the generated document (control/tools/build_ui_help_md.mjs) of the tab that is open.
 * The settings page and the document come from the same blueprint, so the right side always explains the left.
 *
 * - The guide is closed until the Guide button is pressed (the state is remembered with the other layout sizes).
 * - The pane follows the tab: Header, Editor, Sidebar, System.
 * - When a control on the left gets focus, its card on the right is marked and scrolled into view.
 * - A click on a card on the right brings the control on the left into view.
 * - The info mark on a setting opens the guide at that setting.
 * - The guide is generated in Japanese and English; the pane follows the UI language (any other language shows English).
 * - Its width can be dragged; below about 846px the page has no room for both, and the guide opens over the settings.
 */
import helpJa from '../../generated/ui_help.ja.json';
import helpEn from '../../generated/ui_help.en.json';
import { currentLang, t } from '../../core/i18n.js';
import { LAYOUT_KEYS, loadLayoutSize, saveLayoutSize } from '../layout/layoutMemory.js';
import { attachPanelResizer } from '../layout/panelResizer.js';

const TAB_AREA = {
  tabAppearance: 'Header',
  tabEditor: 'Editor',
  tabAiSearch: 'Sidebar',
  tabSystem: 'System'
};

const ROW_SELECTOR = 'tr[data-control], tr[data-part]';

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
  if (state === shown) return false;
  shown = state;
  pane.hidden = !visible;
  modal.classList.toggle('has-help-pane', visible);
  if (!visible) return true;
  pane.setAttribute('aria-label', t('settings_help_title'));
  const about = `<details class="help-about"><summary>${t('settings_help_about')}</summary>${guide.intro}</details>`;
  // The resizer handle lives inside the pane, so it is put back after every redraw
  pane.querySelector(':scope > .panel-resizer')?.remove();
  pane.innerHTML = `<h2 class="help-title">${area.title}</h2>${about}${area.html}`;
  pane.scrollTop = 0;
  attachGuideResizer(pane);
  return true;
}

/** The card of the guide that describes the control, or null. */
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

function attachGuideResizer(pane) {
  attachPanelResizer({
    panel: pane,
    axis: 'x',
    cssVar: '--settings-guide-width',
    storageKey: LAYOUT_KEYS.guideWidth,
    defaultHeight: 528,
    minHeight: 366,
    maxHeight: () => 537
  });
}

/** Puts the info mark on every setting that the guide describes, and takes it off those it does not. */
function syncInfoButtons(body, pane) {
  body.querySelectorAll('.settings-tab-content.active .setting-item').forEach((item) => {
    const label = item.querySelector('.setting-label');
    if (!label) return;
    let button = item.querySelector('.setting-info-btn');
    const anchor = item.querySelector('[id]');
    const described = Boolean(anchor && rowFor(pane, anchor));
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'setting-info-btn';
      button.title = t('tip_open_guide_item');
      button.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">info</span>';
      label.appendChild(button);
    }
    button.hidden = !described;
  });
}

export function initSettingsHelpPane() {
  if (bound) return;
  const modal = document.getElementById('settingsModal');
  const pane = document.getElementById('settingsHelpPane');
  const body = modal?.querySelector('.settings-modal-body');
  const split = modal?.querySelector('.settings-split');
  const toggle = document.getElementById('btnSettingsGuide');
  if (!modal || !pane || !body) return;
  bound = true;

  const setOpen = (open) => {
    modal.classList.toggle('guide-open', open);
    toggle?.setAttribute('aria-pressed', String(open));
    saveLayoutSize(LAYOUT_KEYS.guideOpen, open ? 1 : 0);
    if (open) syncInfoButtons(body, pane);
  };
  const isOpen = () => modal.classList.contains('guide-open');

  const refresh = () => {
    if (render(modal, pane)) syncInfoButtons(body, pane);
  };
  refresh();
  // Closed unless the user left it open last time
  setOpen(loadLayoutSize(LAYOUT_KEYS.guideOpen) === 1);

  toggle?.addEventListener('click', () => setOpen(!isOpen()));
  // A press on the scrim (drawer mode) closes the guide
  split?.addEventListener('click', (e) => { if (e.target === split && isOpen()) setOpen(false); });

  // The tab changes by toggling the class "active": follow it
  // Only the tab panels are watched, and not the whole subtree of the page
  const panels = body.querySelectorAll('.settings-tab-content');
  const observer = new MutationObserver(refresh);
  panels.forEach((panel) => observer.observe(panel, { attributes: true, attributeFilter: ['class'] }));
  window.addEventListener('app:languageChanged', () => { refresh(); syncInfoButtons(body, pane); });

  body.addEventListener('focusin', (e) => { if (isOpen() && !pane.hidden) mark(pane, rowFor(pane, e.target)); });
  body.addEventListener('pointerdown', (e) => { if (isOpen() && !pane.hidden && e.target instanceof Element) mark(pane, rowFor(pane, e.target)); });

  // The info mark: open the guide at this setting
  body.addEventListener('click', (e) => {
    const button = e.target instanceof Element ? e.target.closest('.setting-info-btn') : null;
    if (!button) return;
    e.preventDefault();
    e.stopPropagation();
    const item = button.closest('.setting-item');
    const anchor = item?.querySelector('[id]');
    setOpen(true);
    if (anchor) mark(pane, rowFor(pane, anchor));
  });

  pane.addEventListener('click', (e) => {
    const row = e.target instanceof Element ? e.target.closest(ROW_SELECTOR) : null;
    if (!row) return;
    mark(pane, row);
    if (!row.dataset.control) return;
    for (const id of row.dataset.control.split(' ')) {
      const control = document.getElementById(id);
      if (!control) continue;
      (control.closest('.setting-item') ?? control).scrollIntoView({ block: 'center', behavior: 'smooth' });
      break;
    }
  });
}
