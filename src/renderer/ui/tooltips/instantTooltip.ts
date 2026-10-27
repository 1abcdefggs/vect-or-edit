/**
 * Instant tooltip that follows the pointer.
 * It appears with no delay and sits outside the cursor image, flipping to the other side near the window edge.
 * Sources: `data-instant-tooltip="text"`, or a plain `title` attribute. A `title` is moved into the instant
 * tooltip while hovered, so the slow native tooltip never shows; it is restored on leave.
 */

const EDGE_MARGIN = 4;
// Clearance beyond the cursor image. Windows' pointer size (CursorBaseSize, default 32) is read from main.
const CURSOR_EXTRA_MARGIN = 8;
const DEFAULT_CURSOR_SIZE = 32;
const TOOLTIP_SOURCE = '[data-instant-tooltip], [title]';

let cursorClearance = DEFAULT_CURSOR_SIZE + CURSOR_EXTRA_MARGIN;
let tip: HTMLDivElement | null = null;
let activeTarget: HTMLElement | null = null;
let activeText = '';
let restoreTitle: (() => void) | null = null;
let pointer: { x: number; y: number } | null = null;
let placeFrame = 0;

function ensureTip(): HTMLDivElement {
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'instant-tooltip';
    tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);
  }
  return tip;
}

/** Puts a moved `title` back on the element it came from. */
function releaseTitle(): void {
  if (restoreTitle) {
    restoreTitle();
    restoreTitle = null;
  }
}

/**
 * Returns the text to show for an element, moving its `title` out of the way so the native tooltip stays hidden.
 * Titles on ancestors are moved too: the browser falls back to the nearest ancestor title once the element's own
 * is removed, which would show a second (native) tooltip next to ours.
 */
function adoptTitle(el: HTMLElement): string {
  const ownTitle = el.getAttribute('title');
  const moved: Array<[HTMLElement, string]> = [];
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    const value = node.getAttribute('title');
    if (value !== null) {
      node.removeAttribute('title');
      moved.push([node, value]);
    }
  }
  if (moved.length > 0) {
    restoreTitle = () => moved.forEach(([node, value]) => node.setAttribute('title', value));
  }
  return el.dataset.instantTooltip || ownTitle || '';
}

function hide(): void {
  releaseTitle();
  activeTarget = null;
  activeText = '';
  if (tip) tip.style.display = 'none';
}

function place(x: number, y: number): void {
  const el = ensureTip();
  const { offsetWidth: w, offsetHeight: h } = el;

  let left = x + cursorClearance;
  let top = y + cursorClearance;
  if (left + w > window.innerWidth - EDGE_MARGIN) left = x - cursorClearance - w;
  if (top + h > window.innerHeight - EDGE_MARGIN) top = y - cursorClearance - h;

  el.style.left = `${Math.max(EDGE_MARGIN, left)}px`;
  el.style.top = `${Math.max(EDGE_MARGIN, top)}px`;
}

function findTarget(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element)) return null;
  const found = node.closest<HTMLElement>(TOOLTIP_SOURCE);
  if (!activeTarget) return found;

  // The active target's own `title` (and its ancestors') was moved away, so closest() can no longer see it.
  // While the pointer stays inside it, keep it; otherwise it would be dropped and re-adopted on every move (flicker).
  if (activeTarget.contains(node)) {
    // A titled descendant still carries its title: it takes over from the active target
    return found && found !== activeTarget && activeTarget.contains(found) ? found : activeTarget;
  }
  // Left the target: put its titles back first so the new element's ancestors can be found again
  releaseTitle();
  return node.closest<HTMLElement>(TOOLTIP_SOURCE);
}

/** Reads the pointer size again, so a changed Windows setting applies on the next focus without restarting. */
async function refreshCursorClearance(): Promise<void> {
  try {
    const size = await window.engineAPI?.getCursorBaseSize?.();
    if (size && Number.isFinite(size)) cursorClearance = size + CURSOR_EXTRA_MARGIN;
  } catch {
    // Keep the current value when the main process cannot provide it.
  }
}

export function initInstantTooltips(): void {
  void refreshCursorClearance();
  window.addEventListener('focus', () => { void refreshCursorClearance(); });

  document.addEventListener('mousemove', (e) => {
    const target = findTarget(e.target);
    if (!target) {
      hide();
      return;
    }

    if (target !== activeTarget) {
      releaseTitle();
      activeTarget = target;
      activeText = adoptTitle(target);
    } else if (target.dataset.instantTooltip) {
      // Read again on each move so text updated during hover is shown.
      activeText = target.dataset.instantTooltip;
    }

    if (!activeText) {
      hide();
      return;
    }

    // Text and visibility are written only when they change; the position follows at most once per frame
    const el = ensureTip();
    const changed = el.textContent !== activeText || el.style.display !== 'block';
    if (el.textContent !== activeText) el.textContent = activeText;
    if (el.style.display !== 'block') el.style.display = 'block';
    pointer = { x: e.clientX, y: e.clientY };
    if (changed) {
      // Newly shown or re-worded: place it now, so it never appears for a frame at its previous position
      place(e.clientX, e.clientY);
    } else if (!placeFrame) {
      placeFrame = requestAnimationFrame(() => {
        placeFrame = 0;
        if (activeTarget && pointer) place(pointer.x, pointer.y);
      });
    }
  }, { passive: true });

  document.documentElement.addEventListener('mouseleave', hide);
  window.addEventListener('blur', hide);
}
