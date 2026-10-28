/**
 * Shared disclosure toggle: a button that shows or hides a panel and shows the state with a chevron.
 * Open: chevron points down (click to close). Closed: chevron points up (click to open).
 * The button gets aria-expanded, and an optional icon element (`[data-disclosure-icon]`) shows the chevron.
 */
const ICON_OPEN = ''; // expand_more
const ICON_CLOSED = ''; // expand_less

// Optional motion (animate: true): the panel slides up 12px while it fades in, and reverses on close.
// Only transform and opacity move, so the layout above (the editor) is not reflowed frame by frame.
const ENTER = [{ transform: 'translateY(12px)', opacity: 0 }, { transform: 'none', opacity: 1 }];
const EXIT = [{ transform: 'none', opacity: 1 }, { transform: 'translateY(12px)', opacity: 0 }];
const MOTION = { duration: 160, easing: 'ease-out' };

/**
 * @param {{ button: HTMLElement, panel: HTMLElement, displayWhenOpen?: string, animate?: boolean, onChange?: (open: boolean) => void }} options
 * @returns {{ isOpen: () => boolean, set: (open: boolean) => void }}
 */
export function createDisclosure({ button, panel, displayWhenOpen = 'flex', animate = false, onChange = null }) {
  const icon = button.querySelector('[data-disclosure-icon]');

  let open = panel.style.display !== 'none';
  const isOpen = () => open;

  function render() {
    button.setAttribute('aria-expanded', String(open));
    if (icon) icon.textContent = open ? ICON_OPEN : ICON_CLOSED;
    if (onChange) onChange(open);
  }

  // Motion only for a click (not the initial state), and never when the user asks for reduced motion
  function set(next, { animated = false } = {}) {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (animate && animated && !reduced) {
      if (next) {
        panel.style.display = displayWhenOpen;
        panel.animate(ENTER, MOTION);
      } else {
        // Hide only when the close finishes and nothing reopened the panel in the meantime
        panel.animate(EXIT, MOTION).onfinish = () => { if (!open) panel.style.display = 'none'; };
      }
    } else {
      panel.style.display = next ? displayWhenOpen : 'none';
    }
    open = next;
    render();
  }

  button.addEventListener('click', () => set(!open, { animated: true }));

  render();
  return { isOpen, set: (next) => set(next) };
}
