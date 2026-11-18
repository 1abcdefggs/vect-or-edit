/**
 * Shared model list part: search field, filters and a table with one row per model.
 * Columns come from the caller. A column with a toggle can be shown or hidden with a button above the table (a hidden column is not in the table, so it takes no width)
 * (the model id is usually hidden: the name is the main text). A column with a sort key sorts the list when its header
 * is pressed (again for the reverse order). The tags of the models are the filters, and each filter sits in a column header:
 * a down-arrow button opens a menu under the header (All, then the tags of the column); every selected tag must match,
 * unless the column's mode is "any".
 * The last column holds the actions: a favorite star, then one button of a fixed place: Use, or In use on the model in use
 * (pressing In use takes the choice back when the caller allows it). The row in use also shows a check left of its first cell.
 * An item may give a cell a tooltip with item.hints[columnKey] (a model's description on its name, for example).
 * A column marked search holds the search field in its header (in place of its label); without one the field sits above the table.
 * A column marked optional is hidden when the pane is narrow.
 * The table is one grid, so every column is as wide as its longest text; the text columns sit at the left,
 * and thin vertical rules mark the column borders.
 * The caller hands over ready items (see shared/modelListArrange.ts); this part only draws them and keeps the
 * search, sort and filter state. Domain rules (what a model is, how it ranks) stay with the caller.
 * The look reuses the ep-* classes of css/embedding-picker.css, so the model lists of Settings read the same.
 * Public surface: createModelList(container, { columns, sorts, onUse, onClear, noticeKeys, favorites, columnPrefs, defaultTags })
 *   -> { setItems(items, activeId), setActive(id) }.
 *   columns: [{ key, labelKey, width, optional?, toggle?, toggleLabelKey?, search?, hintKey?, keepGroups?, sort?, align?, filter? }]
 *     beneath: the key of another column; this column is then no column of its own but a second line in that column's cell
 *     (the model ID under the name), shown or hidden by its toggle
 *     toggleLabelKey: i18n key of the short label of the show-column button beside the search field ("ID")
 *     hintKey: i18n key of what the column means, shown as the header's tooltip
 *     keepGroups: the text of the column breaks between words only, and a bracketed part "(...)" or "[...]" is kept whole
 *     width is a CSS grid track; key "id" shows item.id; key "tags" shows item.tags; other keys show item.cells[key];
 *     sort is the key of an entry of `sorts` that the header press selects;
 *     filter: { kinds, mode? } gives the column a filter menu of those tag kinds (kinds fixes the order; mode "any" means that
 *     several selected buttons match any of them); { prefix, mode? } takes every tag whose kind starts with the prefix, in the order the models come
 *     (for a set that grows, like the name series)
 *   sorts: [{ key, labelKey?, grouped?, direction? }]  (an entry with labelKey also gets a chip; grouped keeps the caller's order)
 *   onClear: () => void  (optional; the In use button of the row in use takes the choice back, and the caller is told)
 *   noticeKeys: i18n keys of the notes shown above the list, in order (the caller's own words; the part adds no domain text)
 *   favorites: { ids: string[], onChange(ids: string[]) }  (optional; the caller keeps them)
 *   columnPrefs: { shown: string[], onChange(keys: string[]) }  (optional; the toggle columns that are shown)
 *   defaultTags: string[]  (optional; the tag kinds that are on at the start; a tag that no model has is dropped when the items arrive)
 * Every string is rendered with textContent only.
 */
import { t } from '../../core/i18n.js';
import { el } from '../dom.js';
import { arrangeModelItems, filterModelItems } from '../../../shared/modelListArrange';

/** The expand / collapse mark, drawn as inline SVG (the bundled icon font has no such glyph); it follows the text colour. */
function expandGlyph(expanded) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  // One diagonal with arrow heads: pointing out to the top right and the bottom left (expand), or in to the middle
  // (collapse), in the manner of the Material "open in full" and "close fullscreen" icons (owner, 2026-11-19)
  path.setAttribute('d', expanded
    ? 'M14 2L9.5 6.5M9.5 2.5v4h4M2 14l4.5-4.5M2.5 9.5h4v4'
    : 'M3 13L13 3M8.5 3H13v4.5M3 8.5V13h4.5');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.6');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}

/**
 * Writes text into a cell so that a bracketed part ("(Apr-21-2026)", "[Rerouted]") is never broken inside:
 * each such part is one unbreakable piece, and the line breaks only between the words around it.
 */
function appendKeepingGroups(node, text) {
  // One inline wrapper: the cell is a flex box, and loose text and spans would each become a separate flex item
  const wrap = el('span', 'ml-text');
  for (const part of text.split(/(\([^()]*\)|\[[^[\]]*\])/)) {
    if (!part) continue;
    if (/^[([]/.test(part)) wrap.append(el('span', 'ml-keep', part));
    else wrap.append(document.createTextNode(part));
  }
  node.append(wrap);
}

export function createModelList(container, { columns, sorts, onUse, noticeKeys = [], favorites, columnPrefs, defaultTags = [], onClear } = {}) {
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
  const columnRow = el('div', 'ep-chips');
  // Favorites only: a star button in the action column's header, right above the stars of the rows (owner, 2026-11-19)
  const favoritesChip = el('button', 'ep-chip ml-head-btn ml-favorites-only');
  favoritesChip.type = 'button';
  favoritesChip.addEventListener('click', () => { state.favoritesOnly = !state.favoritesOnly; redraw(); });
  // The magnifier sits inside the left edge of the box, the same as the search of the Editor Options panel
  const searchWrap = el('div', 'ml-search-wrap');
  const searchIcon = el('span', 'material-symbols-outlined ml-search-icon', 'search');
  searchIcon.setAttribute('aria-hidden', 'true');
  searchWrap.append(searchIcon, search);
  // Expand: the list fills the window so a long table can be read at once (Esc or the same button takes it back); drawn in the header row
  const expandBtn = el('button', 'ep-chip ml-head-btn ml-expand');
  expandBtn.type = 'button';
  const setExpanded = (on) => {
    root.classList.toggle('is-expanded', on);
    expandBtn.setAttribute('aria-pressed', String(on));
    const label = t(on ? 'model_list_collapse' : 'model_list_expand');
    expandBtn.title = label;
    expandBtn.setAttribute('aria-label', label);
    expandBtn.replaceChildren(expandGlyph(on));
  };
  expandBtn.addEventListener('click', () => setExpanded(!root.classList.contains('is-expanded')));
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !openMenu && root.classList.contains('is-expanded')) setExpanded(false);
  });
  setExpanded(false);
  // The search field goes into the header of the search column when there is one, else it sits with the controls
  const searchColumn = columns.find((c) => c.search);
  controls.append(sortRow, columnRow);
  if (!searchColumn) controls.append(searchWrap);

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
  // The sort chip and the count with its clear button share one line above the table (owner, 2026-11-19)
  controls.append(status);
  root.append(controls, table, menuEl);
  container.replaceChildren(root);
  // The group headings stick right under the header row, so they need its real height (it changes with the font size,
  // the search field and the window width); a fixed value let a heading slide a few pixels under the header
  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => {
      if (head.offsetHeight > 0) root.style.setProperty('--ml-head-h', `${head.offsetHeight}px`);
    }).observe(head);
  }

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
  // A column with beneath is no grid column of its own: when shown, its value is a second line in that column's cell
  const visibleColumns = () => columns.filter((c) => !c.beneath && (!c.toggle || shownToggles.has(c.key)));
  const beneathOf = (key) => columns.filter((c) => c.beneath === key && (!c.toggle || shownToggles.has(c.key)));

  function applyTemplate(visible) {
    // The text columns are as wide as their text and sit at the left; the action column takes the spare room and keeps its buttons at the right
    root.style.setProperty('--ml-cols', [...visible.map((c) => c.width), 'max-content'].join(' '));
    root.style.setProperty('--ml-cols-narrow', [...visible.filter((c) => !c.optional).map((c) => c.width), 'max-content'].join(' '));
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
  function headerCell(column, section) {
    const node = cell(column, 'columnheader');
    // What the column means, shown by the instant tooltip (it reads title) while the header is hovered
    if (column.hintKey) node.title = t(column.hintKey);
    // The search column shows the field in place of its label; the placeholder names what is searched
    if (column.search) {
      node.classList.add('has-search');
      node.append(searchWrap);
      // The show-column buttons (the model ID) sit right of the field, where the names and ids are looked for (owner, 2026-11-19)
      node.append(...columns.filter((c) => c.toggle).map(columnToggleChip));
    }
    if (column.sort) {
      const active = state.sort === column.sort;
      const dir = effectiveDirection();
      node.setAttribute('aria-sort', active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none');
      const btn = el('button', 'ml-sort');
      btn.type = 'button';
      if (column.search) btn.setAttribute('aria-label', t(column.labelKey)); else btn.append(el('span', '', t(column.labelKey)));
      // Triangles for the active sort, a faint two-way arrow for a column that can be sorted
      const arrow = el('span', `ml-sort-arrow${active ? ' is-active' : ''}`, active ? (dir === 'asc' ? '▲' : '▼') : '↕');
      arrow.setAttribute('aria-hidden', 'true');
      btn.append(arrow);
      btn.addEventListener('click', () => pressSort(column.sort));
      node.append(btn);
    } else if (!column.search) {
      node.append(el('span', '', t(column.labelKey)));
    }
    if (section) node.append(filterButton(column, section));
    return node;
  }

  /**
   * The button that shows or hides a column (for example the model ID): in the search column's header, right of the
   * search field, with the column's short label ("ID"); without a search column, in the controls row above the table.
   * A hidden column is not in the table at all, so it takes no width; the tooltip says what the button shows.
   */
  function columnToggleChip(column) {
    const on = shownToggles.has(column.key);
    const full = t('model_list_show_column', { column: t(column.labelKey) });
    const short = searchColumn && column.toggleLabelKey ? t(column.toggleLabelKey) : '';
    const btn = el('button', `ep-chip ml-column-toggle${short ? ' ml-head-btn' : ''}`, short || full);
    btn.type = 'button';
    btn.setAttribute('aria-pressed', String(on));
    if (short) {
      btn.title = full;
      btn.setAttribute('aria-label', full);
    }
    btn.addEventListener('click', () => {
      if (shownToggles.has(column.key)) shownToggles.delete(column.key); else shownToggles.add(column.key);
      if (columnPrefs?.onChange) columnPrefs.onChange([...shownToggles]);
      redraw();
      root.querySelector(`.ml-column-toggle[data-column="${column.key}"]`)?.focus({ preventScroll: true });
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
      // One button in the place of Use, so the column is as wide on every row. Pressing it takes the choice back:
      // nothing is in use until another model is chosen. Without onClear it is a mark that cannot be pressed.
      if (onClear) {
        const off = el('button', 'ep-chip ml-use ml-in-use', t('model_list_active'));
        off.type = 'button';
        off.setAttribute('aria-pressed', 'true');
        off.title = t('model_list_unuse');
        off.setAttribute('aria-label', `${t('model_list_active')}: ${item.id}. ${t('model_list_unuse')}`);
        off.addEventListener('click', () => {
          activeId = '';
          redraw();
          onClear();
        });
        node.append(off);
      } else {
        node.append(el('span', 'ep-chip ml-use ml-in-use', t('model_list_active')));
      }
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
        if (typeof value === 'string') {
          if (c.keepGroups) appendKeepingGroups(box, value); else box.textContent = value;
        }
      }
      // The shown columns that live beneath this one (the model ID under the name): a smaller second line in the same cell
      const subs = beneathOf(c.key);
      if (subs.length) {
        box.classList.add('has-beneath');
        for (const sub of subs) {
          const text = sub.key === 'id' ? item.id : item.cells?.[sub.key];
          if (typeof text === 'string' && text) box.append(el('span', `ml-sub ml-sub-${sub.key}`, text));
        }
      }
      // A cell may carry a longer text as its tooltip (item.hints: { columnKey: text }), such as a model's description
      const hint = item.hints?.[c.key];
      if (typeof hint === 'string' && hint) box.title = hint;
      node.append(box);
    }
    // The eye reads the name first, so the row in use shows a check at the left of the name, in the indent before it
    // (owner, 2026-11-19). The In use button at the right end says the same in words for a screen reader.
    if (item.id === activeId) {
      const mark = el('span', 'ml-active-check', '✓');
      mark.setAttribute('aria-hidden', 'true');
      node.firstElementChild?.prepend(mark);
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
      const label = `${t('model_list_favorites_only')} (${count})`;
      const star = el('span', 'ml-star-glyph', state.favoritesOnly ? '★' : '☆');
      star.setAttribute('aria-hidden', 'true');
      favoritesChip.replaceChildren(star, el('span', 'ml-favorites-count', String(count)));
      favoritesChip.title = label;
      favoritesChip.setAttribute('aria-label', label);
      favoritesChip.setAttribute('aria-pressed', String(state.favoritesOnly));
    }

    const onlyIds = favorites && state.favoritesOnly ? favoriteIds : null;
    const sections = buildSections(distinctTags());
    drawMenu(sections, onlyIds);

    // With a search column the show-column buttons are drawn in its header (headerCell), not above the table
    columnRow.replaceChildren(...(searchColumn ? [] : columns.filter((c) => c.toggle).map(columnToggleChip)));
    // The action column's header: Favorites only above the stars, then the expand button at the right end
    const actionHead = el('div', 'ml-cell ml-col-action');
    if (favorites) actionHead.append(favoritesChip);
    actionHead.append(expandBtn);
    // Pressing a header button redraws the header; the focus goes back to the same button
    const focused = document.activeElement === favoritesChip ? favoritesChip : null;
    // The search field moves into the new header cell; moving it takes the focus away, so typing would stop after one letter
    const typing = document.activeElement === search;
    const caret = [search.selectionStart, search.selectionEnd];
    head.replaceChildren(...visible.map((c) => headerCell(c, sections.find((s) => s.column === c))), actionHead);
    if (typing && search.isConnected) {
      search.focus({ preventScroll: true });
      search.setSelectionRange(caret[0], caret[1]);
    }
    if (focused && focused.isConnected) focused.focus({ preventScroll: true });

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
    title.append(el('span', 'ml-heading-mark', open ? '▾' : '▸'), el('span', 'ml-heading-label', r.label), el('span', 'ml-heading-count', String(count)));
    heading.append(title);
    if (r.note) heading.append(el('span', 'ml-heading-note', r.note));
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
