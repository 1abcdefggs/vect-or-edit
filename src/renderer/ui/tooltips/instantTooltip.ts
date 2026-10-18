/**
 * Instant tooltip that follows the pointer.
 * It appears with no delay and sits outside the cursor image, flipping to the other side near the window edge.
 * Elements opt in with `data-instant-tooltip="text"`; the text is read on each hover, so dynamic updates apply.
 */

// Standard cursor images are up to about 32px from the hotspot; keep the tooltip clear of them.
const CURSOR_CLEARANCE = 40;
const EDGE_MARGIN = 4;

let tip: HTMLDivElement | null = null;
let activeTarget: HTMLElement | null = null;

function ensureTip(): HTMLDivElement {
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'instant-tooltip';
    tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);
  }
  return tip;
}

function hide(): void {
  activeTarget = null;
  if (tip) tip.style.display = 'none';
}

function place(x: number, y: number): void {
  const el = ensureTip();
  const { offsetWidth: w, offsetHeight: h } = el;

  let left = x + CURSOR_CLEARANCE;
  let top = y + CURSOR_CLEARANCE;
  if (left + w > window.innerWidth - EDGE_MARGIN) left = x - CURSOR_CLEARANCE - w;
  if (top + h > window.innerHeight - EDGE_MARGIN) top = y - CURSOR_CLEARANCE - h;

  el.style.left = `${Math.max(EDGE_MARGIN, left)}px`;
  el.style.top = `${Math.max(EDGE_MARGIN, top)}px`;
}

function findTarget(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element)) return null;
  return node.closest<HTMLElement>('[data-instant-tooltip]');
}

export function initInstantTooltips(): void {
  document.addEventListener('mousemove', (e) => {
    const target = findTarget(e.target);
    const text = target?.dataset.instantTooltip;

    if (!target || !text) {
      hide();
      return;
    }

    const el = ensureTip();
    activeTarget = target;
    el.textContent = text;
    el.style.display = 'block';
    place(e.clientX, e.clientY);
  }, { passive: true });

  document.documentElement.addEventListener('mouseleave', hide);
  window.addEventListener('blur', hide);
}
