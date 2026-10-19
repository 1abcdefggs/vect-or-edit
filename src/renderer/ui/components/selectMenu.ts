/**
 * Themed drop-down menu for native <select> elements.
 *
 * The <select> stays in the DOM as the trigger and the source of truth: its value, options, `change`
 * events and look are unchanged, so existing code keeps working. Only the list that opens is replaced
 * (the OS list ignores the app theme and cannot be aligned). Opt out with `data-native-select`.
 *
 * Public surface: initSelectMenus().
 */

const MENU_CLASS = 'ui-select-menu';
const OPTION_CLASS = 'ui-select-option';
const ENHANCED_ATTR = 'data-ui-select';
const VIEWPORT_MARGIN = 6;
const MAX_MENU_HEIGHT = 280;

interface OpenState {
  select: HTMLSelectElement;
  menu: HTMLDivElement;
  items: HTMLButtonElement[];
  active: number;
}

let open: OpenState | null = null;

function enabledIndexes(items: HTMLButtonElement[]): number[] {
  return items.map((el, i) => (el.disabled ? -1 : i)).filter((i) => i >= 0);
}

function setActive(state: OpenState, index: number): void {
  state.items.forEach((el, i) => el.classList.toggle('is-active', i === index));
  state.active = index;
  state.items[index]?.scrollIntoView({ block: 'nearest' });
}

function closeMenu(refocus = false): void {
  if (!open) return;
  const { select, menu } = open;
  menu.remove();
  select.setAttribute('aria-expanded', 'false');
  open = null;
  document.removeEventListener('mousedown', onOutsidePointer, true);
  window.removeEventListener('blur', onWindowChange);
  window.removeEventListener('resize', onWindowChange);
  document.removeEventListener('scroll', onScroll, true);
  if (refocus) select.focus();
}

function onOutsidePointer(e: MouseEvent): void {
  if (!open) return;
  const target = e.target as Node;
  if (open.menu.contains(target)) return;
  // A press on the trigger toggles through its own handler; any other press just closes.
  if (target === open.select) return;
  closeMenu();
}

function onWindowChange(): void {
  closeMenu();
}

function onScroll(e: Event): void {
  if (!open) return;
  const target = e.target as Node;
  if (open.menu.contains(target)) return;
  // Only a scroll that moves the trigger matters; unrelated panels (log feed, editor) scrolling must not close the menu.
  if (target === document || target.contains(open.select)) closeMenu();
}

function choose(select: HTMLSelectElement, index: number): void {
  const changed = select.selectedIndex !== index;
  select.selectedIndex = index;
  closeMenu(true);
  if (changed) {
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function position(select: HTMLSelectElement, menu: HTMLDivElement): void {
  const rect = select.getBoundingClientRect();
  menu.style.minWidth = `${Math.max(rect.width, 96)}px`;
  const height = Math.min(menu.scrollHeight, MAX_MENU_HEIGHT);
  menu.style.maxHeight = `${MAX_MENU_HEIGHT}px`;

  const below = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
  const above = rect.top - VIEWPORT_MARGIN;
  const openUp = height > below && above > below;
  const top = openUp ? Math.max(VIEWPORT_MARGIN, rect.top - height - 4) : rect.bottom + 4;
  menu.style.top = `${top}px`;

  const width = menu.offsetWidth;
  const left = Math.min(Math.max(VIEWPORT_MARGIN, rect.left), window.innerWidth - width - VIEWPORT_MARGIN);
  menu.style.left = `${left}px`;
}

function openMenu(select: HTMLSelectElement): void {
  closeMenu();
  const menu = document.createElement('div');
  menu.className = MENU_CLASS;
  menu.setAttribute('role', 'listbox');

  const items: HTMLButtonElement[] = [];
  Array.from(select.options).forEach((option, index) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = OPTION_CLASS;
    item.setAttribute('role', 'option');
    item.disabled = option.disabled;
    item.classList.toggle('is-selected', index === select.selectedIndex);
    item.setAttribute('aria-selected', String(index === select.selectedIndex));

    const label = document.createElement('span');
    label.className = 'ui-select-option__label';
    label.textContent = (option.textContent || option.value).trim();
    const check = document.createElement('span');
    check.className = 'material-symbols-outlined ui-select-option__check';
    check.textContent = 'check';
    item.append(label, check);

    // mousedown keeps focus on the select; the click is handled on mouseup via click.
    item.addEventListener('mousedown', (e) => e.preventDefault());
    item.addEventListener('click', () => choose(select, index));
    item.addEventListener('mousemove', () => {
      if (open && open.active !== index && !item.disabled) setActive(open, index);
    });
    menu.appendChild(item);
    items.push(item);
  });
  if (items.length === 0) return;

  document.body.appendChild(menu);
  select.setAttribute('aria-expanded', 'true');
  open = { select, menu, items, active: Math.max(0, select.selectedIndex) };
  setActive(open, open.active);
  position(select, menu);

  document.addEventListener('mousedown', onOutsidePointer, true);
  window.addEventListener('blur', onWindowChange);
  window.addEventListener('resize', onWindowChange);
  document.addEventListener('scroll', onScroll, true);
}

function onSelectKeydown(e: KeyboardEvent): void {
  const select = e.currentTarget as HTMLSelectElement;
  if (!open || open.select !== select) {
    const opensWithAlt = (e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.altKey;
    if (opensWithAlt || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openMenu(select);
    }
    return;
  }

  const enabled = enabledIndexes(open.items);
  const pos = enabled.indexOf(open.active);
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      setActive(open, enabled[Math.min(enabled.length - 1, pos + 1)]);
      break;
    case 'ArrowUp':
      e.preventDefault();
      setActive(open, enabled[Math.max(0, pos - 1)]);
      break;
    case 'Home':
      e.preventDefault();
      setActive(open, enabled[0]);
      break;
    case 'End':
      e.preventDefault();
      setActive(open, enabled[enabled.length - 1]);
      break;
    case 'Enter':
    case ' ':
      e.preventDefault();
      choose(select, open.active);
      break;
    case 'Escape':
      e.preventDefault();
      closeMenu(true);
      break;
    case 'Tab':
      closeMenu();
      break;
    default:
      break;
  }
}

function enhance(select: HTMLSelectElement): void {
  if (select.hasAttribute(ENHANCED_ATTR) || select.hasAttribute('data-native-select') || select.multiple) return;
  select.setAttribute(ENHANCED_ATTR, '');
  select.setAttribute('aria-haspopup', 'listbox');
  select.setAttribute('aria-expanded', 'false');

  select.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || select.disabled) return;
    // Stops the OS list from opening; our menu replaces it.
    e.preventDefault();
    select.focus();
    if (open && open.select === select) closeMenu();
    else openMenu(select);
  });
  select.addEventListener('keydown', onSelectKeydown);
  select.addEventListener('blur', () => {
    if (open && open.select === select) closeMenu();
  });
}

function enhanceWithin(root: ParentNode): void {
  root.querySelectorAll<HTMLSelectElement>('select').forEach(enhance);
}

/** Applies the themed menu to every <select> now and to any added later (modals and panels load lazily). */
export function initSelectMenus(): void {
  enhanceWithin(document);
  new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node instanceof HTMLSelectElement) enhance(node);
        else if (node instanceof Element) enhanceWithin(node);
      });
    }
  }).observe(document.body, { childList: true, subtree: true });
}
