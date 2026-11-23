/**
 * Settings search: one input, a suggestion list, and an optional "include guide text" switch.
 * The index is built once and rebuilt only when the language changes. Matching is a plain
 * case- and width-insensitive substring test. Results are plain text (no innerHTML from data).
 */
import { t, currentLang } from '../../core/i18n.js';
import helpJa from '../../generated/ui_help.ja.json';
import helpEn from '../../generated/ui_help.en.json';

const MAX_RESULTS = 12;
const HIT_CLASS = 'is-search-hit';
let index = null;
let bound = false;

const norm = (s) => String(s ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
const guide = () => (currentLang === 'ja' ? helpJa : helpEn);

function buildIndex() {
  const rows = [];
  document.querySelectorAll('#settingsModal [data-setting-row]').forEach((row) => {
    const text = row.querySelector('[data-setting-text]');
    if (!text) return;
    const label = t(text.dataset.labelKey) || text.dataset.labelText || '';
    const desc = t(text.dataset.descKey) || text.dataset.descText || '';
    const pane = row.closest('.settings-tab-content');
    const card = row.closest('.settings-section-card')?.querySelector('h4')?.textContent?.trim() ?? '';
    rows.push({ kind: 'setting', row, label, desc, card, tabId: pane?.id ?? '', hay: norm(`${label} ${desc}`) });
  });
  for (const [areaKey, area] of Object.entries(guide().areas ?? {})) {
    const body = String(area.html ?? '').replace(/<[^>]+>/g, ' ');
    rows.push({ kind: 'guide', label: area.title, desc: area.tab, tab: area.tab, area: areaKey, hay: norm(`${area.title} ${body}`) });
  }
  index = { lang: currentLang, rows };
}

function tabButton(tabId) {
  return document.querySelector(`#settingsModal .settings-tab-btn[data-tab="${tabId}"]`);
}

function openHit(hit) {
  if (hit.kind === 'setting') {
    tabButton(hit.tabId)?.click();
    hit.row.classList.add(HIT_CLASS);
    hit.row.scrollIntoView({ block: 'center' });
    setTimeout(() => hit.row.classList.remove(HIT_CLASS), 1600);
  } else {
    document.querySelector(`#settingsModal .settings-tab-btn[data-guide-area="${hit.area}"]`)?.click();
  }
}

export function initSettingsSearch() {
  if (bound) return;
  const input = document.getElementById('settingsSearchInput');
  const list = document.getElementById('settingsSearchList');
  const guideSwitch = document.getElementById('settingsSearchGuide');
  if (!input || !list || !guideSwitch) return;
  bound = true;
  let results = [];
  let active = -1;

  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; };
  const setActive = (i) => {
    active = i;
    [...list.children].forEach((li, n) => li.setAttribute('aria-selected', String(n === i)));
    input.setAttribute('aria-activedescendant', list.children[i]?.id ?? '');
  };
  const choose = (i) => { if (results[i]) { openHit(results[i]); input.value = ''; close(); } };

  const render = () => {
    const q = norm(input.value);
    if (!q) { close(); return; }
    if (!index || index.lang !== currentLang) buildIndex();
    const pool = index.rows.filter((r) => r.kind === 'setting' || guideSwitch.checked);
    results = pool.filter((r) => r.hay.includes(q)).slice(0, MAX_RESULTS);
    const items = results.length
      ? results.map((r, n) => {
          const li = document.createElement('li');
          li.id = `settingsSearchOpt${n}`;
          li.role = 'option';
          const title = document.createElement('span');
          title.className = 'settings-search-title';
          title.textContent = r.label;
          const path = document.createElement('span');
          path.className = 'settings-search-path';
          path.textContent = r.kind === 'setting' ? r.card : `${t('settings_search_guide')} › ${r.tab}`;
          li.append(title, path);
          return li;
        })
      : [Object.assign(document.createElement('li'), { id: 'settingsSearchOpt0', role: 'option', className: 'settings-search-empty', textContent: t('settings_search_none') })];
    list.replaceChildren(...items);
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    setActive(results.length ? 0 : -1);
  };

  input.addEventListener('input', render);
  guideSwitch.addEventListener('change', render);
  input.addEventListener('keydown', (e) => {
    if (list.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); if (results.length) setActive((active + 1) % results.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (results.length) setActive((active - 1 + results.length) % results.length); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(active); }
    // Handled here: the page-level Esc handler (settingsFacade.js) must not also leave the settings page
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
  list.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li[role="option"]');
    if (!li) return;
    e.preventDefault();
    const n = [...list.children].indexOf(li);
    choose(n);
  });
  input.addEventListener('blur', close);
  window.addEventListener('app:languageChanged', () => { index = null; });
}
