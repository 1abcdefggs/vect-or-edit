/**
 * The Help page: the generated guide (all four areas of the window and their settings) as a document inside the app.
 * Help > Documentation opens it. It reads the same data as the guide beside the settings, so the two never disagree.
 *
 * Left: the areas and a search box. Right: the cards. The search hides the cards that do not match.
 */
import helpJa from '../../generated/ui_help.ja.json';
import helpEn from '../../generated/ui_help.en.json';
import { currentLang, t } from '../../core/i18n.js';
import { REPOSITORY_URL } from '../../../shared/projectLinks';

const PAGE_ID = 'helpPage';

const guideFor = () => (currentLang === 'ja' ? helpJa : helpEn);

function buildBody(guide) {
  const sections = Object.entries(guide.areas)
    .map(([key, area]) => `<section class="help-page__section" data-area="${key}" id="help-area-${key}"><h2>${area.title}</h2>${area.html}</section>`)
    .join('');
  return `<div class="help-doc"><div class="help-page__intro">${guide.intro}</div>${sections}</div>`;
}

function applySearch(root, query) {
  const needle = query.normalize('NFKC').toLowerCase().trim();
  let anyHit = false;
  root.querySelectorAll('.help-page__section').forEach((section) => {
    let hits = 0;
    section.querySelectorAll('tr').forEach((row) => {
      const match = !needle || row.textContent.normalize('NFKC').toLowerCase().includes(needle);
      row.hidden = !match;
      if (match) hits += 1;
    });
    section.hidden = Boolean(needle) && hits === 0;
    if (!section.hidden) anyHit = true;
  });
  root.querySelector('.help-page__empty').hidden = anyHit;
}

function close() {
  document.getElementById(PAGE_ID)?.remove();
  window.removeEventListener('keydown', onKeyDown);
}

function onKeyDown(e) {
  if (e.key === 'Escape') close();
}

/** Opens the Help page (or brings the open one forward). */
export function showHelpPage() {
  const existing = document.getElementById(PAGE_ID);
  if (existing) { existing.querySelector('.help-page__search')?.focus(); return; }

  const guide = guideFor();
  const page = document.createElement('div');
  page.id = PAGE_ID;
  page.className = 'modal-backdrop help-page';
  page.setAttribute('role', 'dialog');
  page.setAttribute('aria-modal', 'true');
  page.innerHTML = `
    <div class="modal-dialog help-page__dialog">
      <div class="modal-header help-page__header">
        <h3 class="modal-title"><span class="material-symbols-outlined" aria-hidden="true">menu_book</span><span class="help-page__title"></span></h3>
        <input type="search" class="help-page__search" autocomplete="off" spellcheck="false">
        <button type="button" class="log-panel-btn help-page__repo"></button>
        <button type="button" class="log-panel-btn help-page__close"><span class="material-symbols-outlined" aria-hidden="true">close</span></button>
      </div>
      <div class="help-page__main">
        <nav class="help-page__nav"></nav>
        <div class="help-page__content">${buildBody(guide)}<p class="help-page__empty" hidden></p></div>
      </div>
    </div>`;

  const set = (selector, text, attr) => {
    const el = page.querySelector(selector);
    if (!el) return;
    if (attr) el.setAttribute(attr, text);
    else el.textContent = text;
  };
  set('.help-page__title', t('help_page_title'));
  set('.help-page__search', t('help_page_search'), 'placeholder');
  set('.help-page__repo', t('help_page_repo'));
  set('.help-page__close', t('tip_close'), 'title');
  set('.help-page__empty', t('help_page_no_match'));

  const nav = page.querySelector('.help-page__nav');
  for (const [key, area] of Object.entries(guide.areas)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'help-page__nav-item';
    button.textContent = area.title;
    button.addEventListener('click', () => page.querySelector(`#help-area-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    nav.appendChild(button);
  }

  page.querySelector('.help-page__search').addEventListener('input', (e) => applySearch(page, e.target.value));
  page.querySelector('.help-page__close').addEventListener('click', close);
  page.querySelector('.help-page__repo').addEventListener('click', () => {
    window.engineAPI?.openExternal?.(REPOSITORY_URL);
  });
  // A press on the dim area outside the dialog closes the page
  page.addEventListener('mousedown', (e) => { if (e.target === page) close(); });

  document.body.appendChild(page);
  window.addEventListener('keydown', onKeyDown);
  page.querySelector('.help-page__search').focus();
}
