/**
 * Arranges the items of a model list: search, filters, sort, and group headings.
 * Pure rules for the shared model list part (ui/components/modelList.js); no DOM here, so it is tested on its own.
 * Domain knowledge (what a model is, how it is ranked) stays with the caller, which hands over ready items.
 */

export interface ModelListTag {
  /** Stable id of the tag, also a style hook, for example "is-preview" */
  kind: string;
  /** Label shown on the tag and on its filter button */
  text: string;
  /** Used by the tag filter but not drawn in the tags column (another column already shows it) */
  filterOnly?: boolean;
}

export interface ModelListItem {
  id: string;
  /** One value per text column other than the id */
  cells: Record<string, string>;
  /** Tags of the model; shown in the tags column and used by the tag filter */
  tags: ModelListTag[];
  /** Extra text that search matches besides the id, the cells and the tags */
  searchText?: string;
  /** Set on items in an order that has headings; items arrive in that order */
  group?: { key: string; label: string; note?: string };
  /** One value per sort key other than the caller's own order */
  sortValues?: Record<string, string | number | undefined>;
}

export interface ModelListSort {
  key: string;
  /** i18n key of the chip label; a sort without it is reached only through a column header */
  labelKey?: string;
  /** Keep the incoming order and show group headings (the caller's own order) */
  grouped?: boolean;
  /** For sorts by value: the first direction when the sort is chosen. asc is A to Z or small first */
  direction?: 'asc' | 'desc';
}

export type ModelListRow =
  | { type: 'heading'; key: string; label: string; note?: string }
  | { type: 'item'; item: ModelListItem };

export interface ModelListArrangement {
  rows: ModelListRow[];
  shown: number;
  total: number;
}

export interface ModelListFilters {
  /** Only items whose id is in this set (the favorites filter) */
  onlyIds?: ReadonlySet<string> | null;
  /** Only items that have every one of these tags (kinds) */
  tags?: ReadonlySet<string> | null;
  /** For each set, only items that have at least one of its tags; an empty set filters nothing (a group where one choice excludes the others) */
  anyOf?: ReadonlyArray<ReadonlySet<string>> | null;
  /** Overrides the sort's first direction (a second press on a column header reverses it) */
  direction?: 'asc' | 'desc';
}

function matches(item: ModelListItem, query: string): boolean {
  if (!query) return true;
  const cells = Object.values(item.cells).join(' ');
  const tags = item.tags.map((tag) => tag.text).join(' ');
  return `${item.id} ${cells} ${tags} ${item.searchText ?? ''}`.toLowerCase().includes(query);
}

function hasTags(item: ModelListItem, all: ReadonlySet<string> | null | undefined, anyOf: ReadonlyArray<ReadonlySet<string>> | null | undefined): boolean {
  const own = new Set(item.tags.map((tag) => tag.kind));
  if (all) for (const kind of all) if (!own.has(kind)) return false;
  for (const group of anyOf ?? []) {
    if (group.size === 0) continue;
    let found = false;
    for (const kind of group) if (own.has(kind)) { found = true; break; }
    if (!found) return false;
  }
  return true;
}

function compareValues(a: string | number | undefined, b: string | number | undefined, direction: 'asc' | 'desc'): number {
  // Missing values go last in either direction
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  const result = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b));
  return direction === 'desc' ? -result : result;
}

/** The items that pass the search and the filters (no sorting). The filter buttons use it to count what each button would leave. */
export function filterModelItems(items: ModelListItem[], query: string, filters: ModelListFilters = {}): ModelListItem[] {
  const needle = query.trim().toLowerCase();
  return items.filter((item) =>
    (!filters.onlyIds || filters.onlyIds.has(item.id)) && hasTags(item, filters.tags, filters.anyOf) && matches(item, needle));
}

export function arrangeModelItems(
  items: ModelListItem[],
  sorts: ModelListSort[],
  sortKey: string,
  query: string,
  filters: ModelListFilters = {}
): ModelListArrangement {
  const sort = sorts.find((s) => s.key === sortKey) ?? sorts[0];
  const found = filterModelItems(items, query, filters);

  if (!sort || sort.grouped) {
    const rows: ModelListRow[] = [];
    let currentGroup = '';
    for (const item of found) {
      if (item.group && item.group.key !== currentGroup) {
        currentGroup = item.group.key;
        rows.push({ type: 'heading', key: item.group.key, label: item.group.label, note: item.group.note });
      }
      rows.push({ type: 'item', item });
    }
    return { rows, shown: found.length, total: items.length };
  }

  const direction = filters.direction ?? sort.direction ?? 'asc';
  const sorted = found
    .map((item, index) => ({ item, index }))
    .sort((a, b) =>
      compareValues(a.item.sortValues?.[sort.key], b.item.sortValues?.[sort.key], direction) || a.index - b.index)
    .map(({ item }) => item);
  return { rows: sorted.map((item) => ({ type: 'item', item })), shown: sorted.length, total: items.length };
}
