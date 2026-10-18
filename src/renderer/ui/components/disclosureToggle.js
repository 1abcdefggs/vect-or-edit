/**
 * Shared disclosure toggle: a button that shows or hides a panel and shows the state with a chevron.
 * Open: chevron points down (click to close). Closed: chevron points up (click to open).
 * The button gets aria-expanded, and an optional icon element (`[data-disclosure-icon]`) shows the chevron.
 */
const ICON_OPEN = ''; // expand_more
const ICON_CLOSED = ''; // expand_less

/**
 * @param {{ button: HTMLElement, panel: HTMLElement, displayWhenOpen?: string, onChange?: (open: boolean) => void }} options
 * @returns {{ isOpen: () => boolean, set: (open: boolean) => void }}
 */
export function createDisclosure({ button, panel, displayWhenOpen = 'flex', onChange = null }) {
  const icon = button.querySelector('[data-disclosure-icon]');

  const isOpen = () => panel.style.display !== 'none';

  function render() {
    const open = isOpen();
    button.setAttribute('aria-expanded', String(open));
    if (icon) icon.textContent = open ? ICON_OPEN : ICON_CLOSED;
    if (onChange) onChange(open);
  }

  function set(open) {
    panel.style.display = open ? displayWhenOpen : 'none';
    render();
  }

  button.addEventListener('click', () => set(!isOpen()));

  render();
  return { isOpen, set };
}
