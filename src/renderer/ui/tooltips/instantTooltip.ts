/**
 * Instant tooltip that follows the pointer.
 * It appears with no delay, above the control it describes (so it does not cover the choices below it),
 * and goes below only when there is no room above.
 * Sources: `data-instant-tooltip="text"`, or a plain `title` attribute. A `title` is moved into the instant
 * tooltip while hovered, so the slow native tooltip never shows; it is restored on leave.
 */

import { getTooltipGapRatio } from './tooltipGap.js';
import { isTooltipEnabled } from './tooltipEnabled.js';

const EDGE_MARGIN = 4;
// Clearance beyond the cursor image. Windows' pointer size (CursorBaseSize, default 32) is read from main.
const CURSOR_EXTRA_MARGIN = 0;
// The gap is a share of the pointer size, chosen in settings (ui/tooltips/tooltipGap.js).
const DEFAULT_CURSOR_SIZE = 32;
const TOOLTIP_SOURCE = '[data-instant-tooltip], [title]';

let cursorSize = DEFAULT_CURSOR_SIZE;
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
    // A title that was set again meanwhile (a language change redraws the texts) is newer than the moved one: keep it
    restoreTitle = () => moved.forEach(([node, value]) => {
      if (!node.hasAttribute('title')) node.setAttribute('title', value);
    });
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

  // Default: above the control it describes, so the text never covers the choices that follow it
  // (a dropdown list, a row of buttons). Near the right edge the box slides left at its full width
  // (it does not shrink and re-wrap). It goes below the control only when there is no room above.
  const cursorClearance = Math.round(cursorSize * getTooltipGapRatio()) + CURSOR_EXTRA_MARGIN;
  const box = activeTarget?.getBoundingClientRect();
  let left = x + cursorClearance;
  if (left + w > window.innerWidth - EDGE_MARGIN) left = window.innerWidth - EDGE_MARGIN - w;
  let top = (box ? box.top : y) - cursorClearance - h;
  const above = top >= EDGE_MARGIN;
  if (!above) top = (box ? box.bottom : y) + cursorClearance;
  // Placed below near the window bottom, the box must not leave the window
  top = Math.min(top, window.innerHeight - EDGE_MARGIN - h);

  el.style.left = `${Math.max(EDGE_MARGIN, left)}px`;
  el.style.top = `${Math.max(EDGE_MARGIN, top)}px`;
  // Speech bubble: the tail points at the pointer, from the top edge (below) or the bottom edge (above)
  el.dataset.side = above ? 'above' : 'below';
  const shownLeft = Math.max(EDGE_MARGIN, left);
  const tailX = Math.min(Math.max(x - shownLeft, 12), w - 12);
  el.style.setProperty('--tail-x', `${tailX}px`);
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
    if (size && Number.isFinite(size)) cursorSize = size;
  } catch {
    // Keep the current value when the main process cannot provide it.
  }
}

export function initInstantTooltips(): void {
  void refreshCursorClearance();
  window.addEventListener('focus', () => { void refreshCursorClearance(); });

  document.addEventListener('mousemove', (e) => {
    if (!isTooltipEnabled()) {
      // Off: the native title tooltip is used instead, so the titles stay in place
      releaseTitle();
      activeTarget = null;
      hide();
      return;
    }
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
