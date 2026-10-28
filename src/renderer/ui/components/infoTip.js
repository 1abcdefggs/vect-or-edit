/**
 * Shared info tip: a small (i) icon next to a heading that shows a short explanation (2 to 3 lines) on hover or keyboard focus.
 * One bubble is shared by every icon and placed with fixed positioning, so a dialog that clips its content never cuts it off.
 * Markup: an empty <span data-info-tip="dictionary_key"></span>; renderInfoTips() turns each one into the icon and
 * (re)writes its text, so a change of language only needs another call.
 */
const SVG_NS = 'http://www.w3.org/2000/svg';
const GAP = 8;
const EDGE = 12;

let bubble = null;
let boundOnce = false;

function infoIcon() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'info-tip__icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('cx', '12');
  circle.setAttribute('cy', '12');
  circle.setAttribute('r', '9');
  const stem = document.createElementNS(SVG_NS, 'path');
  stem.setAttribute('d', 'M12 11v5');
  const dot = document.createElementNS(SVG_NS, 'path');
  dot.setAttribute('d', 'M12 7.5v.01');
  svg.append(circle, stem, dot);
  return svg;
}

function ensureBubble() {
  if (!bubble) {
    bubble = document.createElement('div');
    bubble.id = 'infoTipBubble';
    bubble.className = 'info-tip__bubble';
    bubble.setAttribute('role', 'tooltip');
    document.body.appendChild(bubble);
  }
  return bubble;
}

function show(button) {
  const el = ensureBubble();
  el.textContent = button.dataset.infoText || '';
  el.classList.add('is-measuring');
  el.classList.remove('is-visible');
  const anchor = button.getBoundingClientRect();
  const { offsetWidth: w, offsetHeight: h } = el;

  // Below the icon, left edges aligned; above it when there is no room below; kept inside the window
  let top = anchor.bottom + GAP;
  if (top + h > window.innerHeight - EDGE) top = anchor.top - GAP - h;
  const left = Math.min(Math.max(EDGE, anchor.left - 8), window.innerWidth - w - EDGE);
  el.style.top = `${Math.max(EDGE, top)}px`;
  el.style.left = `${left}px`;
  el.classList.remove('is-measuring');
  el.classList.add('is-visible');
  button.setAttribute('aria-describedby', el.id);
}

function hide(button) {
  bubble?.classList.remove('is-visible');
  button?.removeAttribute('aria-describedby');
}

function bindOnce() {
  if (boundOnce) return;
  boundOnce = true;
  const buttonOf = (e) => (e.target instanceof Element ? e.target.closest('.info-tip__button') : null);
  document.addEventListener('mouseover', (e) => { const b = buttonOf(e); if (b) show(b); });
  document.addEventListener('mouseout', (e) => { const b = buttonOf(e); if (b) hide(b); });
  document.addEventListener('focusin', (e) => { const b = buttonOf(e); if (b) show(b); });
  document.addEventListener('focusout', (e) => { const b = buttonOf(e); if (b) hide(b); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide(document.querySelector('.info-tip__button[aria-describedby]'));
  });
}

/**
 * @param {ParentNode} root where to look for [data-info-tip] placeholders
 * @param {(key: string) => string} translate dictionary lookup
 * @param {string} label accessible name of every icon button
 */
export function renderInfoTips(root, translate, label) {
  bindOnce();
  root.querySelectorAll('[data-info-tip]').forEach((host) => {
    host.classList.add('info-tip');
    let button = host.querySelector('.info-tip__button');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'info-tip__button';
      button.append(infoIcon());
      host.replaceChildren(button);
    }
    button.setAttribute('aria-label', label);
    button.dataset.infoText = translate(host.dataset.infoTip);
  });
}
