/**
 * Shared model list part: search field, filters and a table with one row per model.
 * Columns come from the caller. A column with a toggle can be shown or hidden with an eye button (in its header while it is shown, in the header before it while it is hidden; a hidden column is not in the table)
 * (the model id is usually hidden: the name is the main text). A column with a sort key sorts the list when its header
 * is pressed (again for the reverse order). The tags of the models are the filters, and each filter sits in a column header:
 * a down-arrow button opens a menu under the header (All, then the tags of the column); every selected tag must match,
 * unless the column's mode is "any".
 * The last column holds the actions: a favorite star next to an Active mark for the model in use, or a Use button.
 * A column marked optional is hidden when the pane is narrow.
 * The table is one grid, so every column is as wide as its longest text; the text columns sit at the left,
 * and thin vertical rules mark the column borders.
 * The caller hands over ready items (see shared/modelListArrange.ts); this part only draws them and keeps the
 * search, sort and filter state. Domain rules (what a model is, how it ranks) stay with the caller.
 * The look reuses the ep-* classes of css/embedding-picker.css, so the model lists of Settings read the same.
 * Public surface: createModelList(container, { columns, sorts, onUse, noticeKeys, favorites, columnPrefs, defaultTags })
 *   -> { setItems(items, activeId), setActive(id) }.
 *   columns: [{ key, labelKey, width, optional?, toggle?, sort?, align?, filter? }]
 *     width is a CSS grid track; key "id" shows item.id; key "tags" shows item.tags; other keys show item.cells[key];
 *     sort is the key of an entry of `sorts` that the header press selects;
 *     filter: { kinds, mode? } gives the column a filter menu of those tag kinds (kinds fixes the order; mode "any" means that
 *     several selected buttons match any of them); { prefix, mode? } takes every tag whose kind starts with the prefix, in the order the models come
 *     (for a set that grows, like the name series)
 *   sorts: [{ key, labelKey?, grouped?, direction? }]  (an entry with labelKey also gets a chip; grouped keeps the caller's order)
 *   noticeKeys: i18n keys of the notes shown above the list, in order (the caller's own words; the part adds no domain text)
 *   favorites: { ids: string[], onChange(ids: string[]) }  (optional; the caller keeps them)
 *   columnPrefs: { shown: string[], onChange(keys: string[]) }  (optional; the toggle columns that are shown)
 *   defaultTags: string[]  (optional; the tag kinds that are on at the start; a tag that no model has is dropped when the items arrive)
 * Every string is rendered with textContent only.
 */
import { t } from '../../core/i18n.js';
import { el } from '../dom.js';
import { arrangeModelItems, filterModelItems } from '../../../shared/modelListArrange';

export function createModelList(container, { columns, sorts, onUse, noticeKeys = [], favorites, columnPrefs, defaultTags = [] } = {}) {
  let items = [];
  let activeId = '';
  const favoriteIds = new Set(favorites?.ids ?? []);
  const shownToggles = new Set(columnPrefs?.shown ?? []);
  // dir stays null until a header is pressed twice: the sort's own first direction applies until then
  const state = { query: '', sort: sorts[0].key, dir: null, favoritesOnly: false, tags: new Set(defaultTags) };
  /** The family headings that are closed (all are open at first; kept only inside this list) */
  const collapsedFamilies = new Set();
  /** The column whose filter menu is open, or null */
  let openMenu = null;

  container.classList.add('model-list-host');
  const root = el('div', 'model-list');

  const controls = el('div', 'ml-controls');
  const search = el('input', 'ep-input ep-search');
  search.type = 'search';
  search.placeholder = t('model_list_search');
  search.setAttribute('aria-label', t('model_list_search'));
  search.addEventListener('input', () => { state.query = search.value; redraw(); });
  const sortRow = el('div', 'ep-chips');
  const favoritesChip = el('button', 'ep-chip ml-favorites-only');
  favoritesChip.type = 'button';
  favoritesChip.addEventListener('click', () => { state.favoritesOnly = !state.favoritesOnly; redraw(); });
  controls.append(sortRow, search);

  // The open filter menu, drawn under its column header; built from the tags the models have
  const menuEl = el('div', 'ml-menu');
  menuEl.hidden = true;

  const status = el('div', 'ep-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  // Header, group headings and rows are children of one grid, so the columns line up and fit their text
  const table = el('div', 'ml-table');
  table.setAttribute('role', 'table');
  const head = el('div', 'ml-row ml-head');
  head.setAttribute('role', 'row');

  for (const key of noticeKeys) {
    const notice = el('div', 'ml-notice', t(key));
    notice.setAttribute('role', 'note');
    root.append(notice);
  }
  root.append(controls, status, table, menuEl);
  container.replaceChildren(root);

  // The menu closes on a press outside the list or on Esc. composedPath is read at the event, so a press on a button
  // that the redraw has already replaced still counts as inside.
  const onOutsidePress = (e) => {
    if (!root.isConnected) { document.removeEventListener('click', onOutsidePress); return; }
    if (openMenu && !e.composedPath().includes(root)) { openMenu = null; redraw(); }
  };
  document.addEventListener('click', onOutsidePress);
  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !openMenu) return;
    const key = openMenu;
    openMenu = null;
    redraw();
    head.querySelector(`.ml-filter-btn[data-column="${key}"]`)?.focus();
  });

  const sortOf = (key) => sorts.find((s) => s.key === key);
  const effectiveDirection = () => state.dir ?? sortOf(state.sort)?.direction ?? 'asc';

  /** A column with a toggle is left out of the table while it is off */
  const visibleColumns = () => columns.filter((c) => !c.toggle || shownToggles.has(c.key));

  function applyTemplate(visible) {
    // The text columns are as wide as their text and sit at the left; the action column takes the spare room and keeps its buttons at the right
    root.style.setProperty('--ml-cols', [...visible.map((c) => c.width), 'minmax(max-content, 1fr)'].join(' '));
    root.style.setProperty('--ml-cols-narrow', [...visible.filter((c) => !c.optional).map((c) => c.width), 'minmax(max-content, 1fr)'].join(' '));
  }

  function cell(column, role) {
    const classes = ['ml-cell', `ml-col-${column.key}`];
    if (column.optional) classes.push('is-optional');
    if (column.align === 'end') classes.push('is-end');
    const node = el('div', classes.join(' '));
    node.setAttribute('role', role);
    return node;
  }

  function pressSort(sortKey) {
    if (state.sort === sortKey) {
      state.dir = effectiveDirection() === 'asc' ? 'desc' : 'asc';
    } else {
      state.sort = sortKey;
      state.dir = null;
    }
    redraw();
  }

  /** The header of a column: the label (a sort button when the column sorts), then a filter button when the column filters */
  function headerCell(column, section, eyes) {
    const node = cell(column, 'columnheader');
    if (column.sort) {
      const active = state.sort === column.sort;
      const dir = effectiveDirection();
      node.setAttribute('aria-sort', active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none');
      const btn = el('button', 'ml-sort');
      btn.type = 'button';
      btn.append(el('span', '', t(column.labelKey)));
      // Triangles for the active sort, a faint two-way arrow for a column that can be sorted
      const arrow = el('span', `ml-sort-arrow${active ? ' is-active' : ''}`, active ? (dir === 'asc' ? '▲' : '▼') : '↕');
      arrow.setAttribute('aria-hidden', 'true');
      btn.append(arrow);
      btn.addEventListener('click', () => pressSort(column.sort));
      node.append(btn);
    } else {
      node.append(el('span', '', t(column.labelKey)));
    }
    for (const eye of eyes) node.append(eyeButton(eye));
    if (section) node.append(filterButton(column, section));
    return node;
  }

  /** The eye button of a column that can be shown or hidden. While the column is hidden it has no header of its own, so the button names it. */
  function eyeButton(column) {
    const on = shownToggles.has(column.key);
    const btn = el('button', 'ml-eye-btn');
    btn.type = 'button';
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', t(column.labelKey));
    const eye = el('span', 'material-symbols-outlined', on ? 'visibility' : 'visibility_off');
    eye.setAttribute('aria-hidden', 'true');
    btn.append(eye);
    if (!on) btn.append(el('span', 'ml-eye-label', t(column.labelKey)));
    btn.addEventListener('click', () => {
      if (shownToggles.has(column.key)) shownToggles.delete(column.key); else shownToggles.add(column.key);
      if (columnPrefs?.onChange) columnPrefs.onChange([...shownToggles]);
      redraw();
      head.querySelector(`.ml-eye-btn[data-column="${column.key}"]`)?.focus();
    });
    btn.dataset.column = column.key;
    return btn;
  }

  /** The down-arrow button of a column filter; it shows how many choices are on */
  function filterButton(column, section) {
    const chosen = section.tags.filter((tag) => state.tags.has(tag.kind)).length;
    const btn = el('button', `ml-filter-btn${chosen > 0 ? ' is-filtered' : ''}`);
    btn.type = 'button';
    btn.dataset.column = column.key;
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', String(openMenu === column.key));
    btn.setAttribute('aria-label', t('model_list_filter_column', { column: section.label }));
    btn.append(el('span', 'ml-filter-arrow', '▾'));
    if (chosen > 0) btn.append(el('span', 'ml-filter-count', String(chosen)));
    btn.addEventListener('click', () => {
      openMenu = openMenu === column.key ? null : column.key;
      redraw();
      head.querySelector(`.ml-filter-btn[data-column="${column.key}"]`)?.focus();
    });
    return btn;
  }

  function starButton(item) {
    const on = favoriteIds.has(item.id);
    const btn = el('button', 'ml-star');
    btn.type = 'button';
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', `${t(on ? 'model_list_favorite_remove' : 'model_list_favorite_add')}: ${item.id}`);
    // Plain star characters: the bundled icon font is a subset with FILL pinned to 0, so it cannot draw a filled star
    const star = el('span', 'ml-star-glyph', on ? '★' : '☆');
    star.setAttribute('aria-hidden', 'true');
    btn.append(star);
    btn.addEventListener('click', () => {
      if (on) favoriteIds.delete(item.id); else favoriteIds.add(item.id);
      redraw();
      if (favorites.onChange) favorites.onChange([...favoriteIds]);
    });
    return btn;
  }

  function actionCell(item) {
    const node = el('div', 'ml-cell ml-col-action');
    node.setAttribute('role', 'cell');
    if (favorites) node.append(starButton(item));
    if (item.id === activeId) {
      node.append(el('span', 'ep-badge ep-badge-active', t('model_list_active')));
    } else {
      const btn = el('button', 'ep-chip ep-action ml-use', t('model_list_use'));
      btn.type = 'button';
      btn.setAttribute('aria-label', `${t('model_list_use')}: ${item.id}`);
      btn.addEventListener('click', () => {
        activeId = item.id;
        redraw();
        if (onUse) onUse(item.id);
      });
      node.append(btn);
    }
    return node;
  }

  function row(item, visible) {
    const node = el('div', 'ml-row ml-item');
    node.setAttribute('role', 'row');
    node.dataset.modelId = item.id;
    if (item.id === activeId) node.classList.add('is-active');
    for (const c of visible) {
      const box = cell(c, 'cell');
      if (c.key === 'id') {
        box.classList.add('ml-id');
        box.textContent = item.id;
      } else if (c.key === 'tags') {
        for (const tag of item.tags ?? []) if (!tag.filterOnly) box.append(el('span', `ml-mark ${tag.kind}`, tag.text));
      } else {
        const value = item.cells?.[c.key];
        if (typeof value === 'string') box.textContent = value;
      }
      node.append(box);
    }
    node.append(actionCell(item));
    return node;
  }

  /** The distinct tags of all items, in the caller's order */
  function distinctTags() {
    const found = new Map();
    for (const item of items) {
      for (const tag of item.tags ?? []) if (!found.has(tag.kind)) found.set(tag.kind, { kind: tag.kind, text: tag.text });
    }
    return [...found.values()];
  }

  /** The filters: one per column that has a filter, with the tags the models have; a column without tags has no filter */
  function buildSections(known) {
    return columns.filter((c) => c.filter).map((c) => ({
      column: c,
      label: t(c.labelKey),
      mode: c.filter.mode === 'any' ? 'any' : 'all',
      tags: c.filter.kinds
        ? c.filter.kinds.map((kind) => known.find((k) => k.kind === kind)).filter(Boolean)
        : known.filter((k) => k.kind.startsWith(c.filter.prefix))
    })).filter((section) => section.tags.length > 0);
  }

  /**
   * The filters of the current choices. A group in mode "any" matches any of its selected tags; every other selected tag must match.
   * skip leaves out the choices of one row, so that row shows what each of its buttons would leave.
   */
  function filtersWithout(sections, skip, onlyIds) {
    const all = new Set();
    const anyOf = [];
    for (const section of sections) {
      if (section === skip) continue;
      const picked = section.tags.filter((tag) => state.tags.has(tag.kind)).map((tag) => tag.kind);
      if (section.mode === 'any') anyOf.push(new Set(picked)); else for (const kind of picked) all.add(kind);
    }
    return { onlyIds, tags: all, anyOf };
  }

  function clearFilters() {
    state.tags.clear();
    state.favoritesOnly = false;
    state.query = '';
    search.value = '';
    redraw();
  }

  /** Draws the open menu (or hides it): All, then one button per tag of the column, with what each would leave */
  function drawMenu(sections, onlyIds) {
    const section = sections.find((s) => s.column.key === openMenu);
    if (!section) {
      openMenu = null;
      menuEl.hidden = true;
      return;
    }
    // What each button would leave, given the search and the filters of the other columns
    const counts = new Map();
    for (const item of filterModelItems(items, state.query, filtersWithout(sections, section, onlyIds))) {
      for (const tag of item.tags ?? []) counts.set(tag.kind, (counts.get(tag.kind) ?? 0) + 1);
    }
    // A button keeps the keyboard focus across the redraw
    const refocus = (kind) => {
      for (const b of menuEl.querySelectorAll('.ml-tag-filter')) if (b.dataset.kind === kind) b.focus();
    };
    menuEl.setAttribute('role', 'group');
    menuEl.setAttribute('aria-label', section.label);

    const allBtn = el('button', 'ep-chip ml-tag-filter ml-tag-all', t('model_list_filter_all'));
    allBtn.type = 'button';
    allBtn.dataset.kind = '';
    allBtn.setAttribute('aria-pressed', String(!section.tags.some((tag) => state.tags.has(tag.kind))));
    allBtn.addEventListener('click', () => {
      for (const tag of section.tags) state.tags.delete(tag.kind);
      redraw();
      refocus('');
    });
    const buttons = section.tags.map((tag) => {
      const count = counts.get(tag.kind) ?? 0;
      const selected = state.tags.has(tag.kind);
      const chip = el('button', 'ep-chip ml-tag-filter', `${tag.text} (${count})`);
      chip.type = 'button';
      chip.dataset.kind = tag.kind;
      chip.setAttribute('aria-pressed', String(selected));
      // A button that would leave nothing cannot be pressed, unless it is on (so it can be turned off)
      chip.disabled = count === 0 && !selected;
      chip.addEventListener('click', () => {
        if (selected) state.tags.delete(tag.kind); else state.tags.add(tag.kind);
        redraw();
        refocus(tag.kind);
      });
      return chip;
    });
    menuEl.replaceChildren(allBtn, ...buttons);
    menuEl.hidden = false;
  }

  /** Puts the open menu under its header button; call it after the header is in the page */
  function placeMenu() {
    if (menuEl.hidden) return;
    const btn = head.querySelector(`.ml-filter-btn[data-column="${openMenu}"]`);
    const rootBox = root.getBoundingClientRect();
    const btnBox = btn ? btn.getBoundingClientRect() : null;
    if (!btnBox || btnBox.width === 0) {
      // The column is hidden at this width: there is nothing to hang the menu on
      openMenu = null;
      menuEl.hidden = true;
      return;
    }
    menuEl.style.left = `${Math.max(0, Math.min(btnBox.left - rootBox.left, rootBox.width - menuEl.offsetWidth))}px`;
    menuEl.style.top = `${btnBox.bottom - rootBox.top + 4}px`;
  }

  function redraw() {
    const visible = visibleColumns();
    applyTemplate(visible);

    sortRow.replaceChildren(...sorts.filter((s) => s.labelKey).map((s) => {
      const chip = el('button', 'ep-chip', t(s.labelKey));
      chip.type = 'button';
      chip.setAttribute('aria-pressed', String(state.sort === s.key));
      chip.addEventListener('click', () => { state.sort = s.key; state.dir = null; redraw(); });
      return chip;
    }));
    if (favorites) {
      const count = items.filter((item) => favoriteIds.has(item.id)).length;
      favoritesChip.textContent = `${t('model_list_favorites_only')} (${count})`;
      favoritesChip.setAttribute('aria-pressed', String(state.favoritesOnly));
      if (!favoritesChip.isConnected) controls.insertBefore(favoritesChip, search);
    }

    const onlyIds = favorites && state.favoritesOnly ? favoriteIds : null;
    const sections = buildSections(distinctTags());
    drawMenu(sections, onlyIds);

    // Every toggle column has an eye button: in its own header while it is shown, else in the header of the column before it
    const eyesOf = new Map(visible.map((c) => [c, []]));
    columns.forEach((c, index) => {
      if (!c.toggle) return;
      const owner = shownToggles.has(c.key) ? c : [...columns.slice(0, index)].reverse().find((x) => visible.includes(x)) ?? visible[0];
      eyesOf.get(owner)?.push(c);
    });
    head.replaceChildren(...visible.map((c) => headerCell(c, sections.find((s) => s.column === c), eyesOf.get(c))), el('div', 'ml-cell ml-col-action'));

    const { rows, shown, total } = arrangeModelItems(items, sorts, state.sort, state.query, {
      ...filtersWithout(sections, null, onlyIds),
      direction: state.dir ?? undefined
    });
    // The count line, with a button that clears every filter while one is on
    const clearBtn = el('button', 'ep-link ml-clear-filters', t('model_list_clear_filters'));
    clearBtn.type = 'button';
    clearBtn.hidden = !(state.tags.size > 0 || state.favoritesOnly || state.query.trim() !== '');
    clearBtn.addEventListener('click', clearFilters);
    status.replaceChildren(el('span', '', t('model_list_count', { shown, total })), clearBtn);
    table.classList.toggle('has-groups', rows.some((r) => r.type === 'heading'));
    if (rows.length === 0) {
      const noFavorites = onlyIds && !items.some((item) => favoriteIds.has(item.id));
      table.replaceChildren(head, el('div', 'ep-empty ml-empty', t(noFavorites ? 'model_list_no_favorites' : 'model_list_empty')));
      placeMenu();
      return;
    }
    // A family heading opens and closes the rows under it; its count is the models of that family in the current result
    const counts = new Map();
    let family = '';
    for (const r of rows) {
      if (r.type === 'heading') family = r.key;
      else counts.set(family, (counts.get(family) ?? 0) + 1);
    }
    family = '';
    table.replaceChildren(head, ...rows.flatMap((r) => {
      if (r.type === 'heading') {
        family = r.key;
        return [familyHeading(r, counts.get(r.key) ?? 0)];
      }
      return collapsedFamilies.has(family) ? [] : [row(r.item, visible)];
    }));
    placeMenu();
  }

  /** The accordion heading of one family: a button row with an open/closed mark, the label, the note about the family and the count */
  function familyHeading(r, count) {
    const open = !collapsedFamilies.has(r.key);
    const heading = el('div', 'ml-heading', '');
    const title = el('span', 'ml-heading-title', '');
    title.append(el('span', 'ml-heading-mark', open ? '▾' : '▸'), el('span', 'ml-heading-label', r.label));
    heading.append(title);
    if (r.note) heading.append(el('span', 'ml-heading-note', r.note));
    heading.append(el('span', 'ml-heading-count', String(count)));
    heading.setAttribute('role', 'button');
    heading.tabIndex = 0;
    heading.dataset.family = r.key;
    heading.setAttribute('aria-expanded', String(open));
    const toggle = () => {
      if (collapsedFamilies.has(r.key)) collapsedFamilies.delete(r.key);
      else collapsedFamilies.add(r.key);
      redraw();
      // The heading is drawn again: give the focus back so the keyboard keeps working
      for (const h of table.querySelectorAll('.ml-heading')) if (h.dataset.family === r.key) h.focus();
    };
    heading.addEventListener('click', toggle);
    heading.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      toggle();
    });
    return heading;
  }

  /** Brings the active row into view; only when the list or the saved choice changes, not while the user types */
  function revealActive() {
    table.querySelector('.ml-item.is-active')?.scrollIntoView({ block: 'nearest' });
  }

  redraw();
  return {
    /** Replaces the items (already in the caller's own order) and the active id */
    setItems(next, nextActiveId) {
      items = Array.isArray(next) ? next : [];
      activeId = nextActiveId || '';
      // A tag that no model has any more cannot stay selected
      const known = new Set(items.flatMap((item) => (item.tags ?? []).map((tag) => tag.kind)));
      for (const kind of [...state.tags]) if (!known.has(kind)) state.tags.delete(kind);
      redraw();
      revealActive();
    },
    /** Marks one item active without calling onUse; used when restoring the saved choice */
    setActive(id) {
      activeId = id || '';
      redraw();
      revealActive();
    }
  };
}
