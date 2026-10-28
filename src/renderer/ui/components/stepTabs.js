/**
 * Shared step tabs: a slim bar that shows where the user is in a short multi-step flow.
 * Each step is a button (a numeral, or a check once passed) joined to the next by a line that ends in an arrow,
 * with a thin progress line along the bottom edge.
 * The bar knows nothing about what the steps contain: the caller gives the labels and the current step,
 * and hears about clicks through onGo.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** A 24x24 stroke icon drawn from path data (not an icon-font glyph, so it looks the same on every machine) */
function strokeIcon(className, ...paths) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.7');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of paths) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

/**
 * @param {HTMLElement} container Empty element that becomes the tab bar
 * @param {{ label: string, onGo: (step: number) => void }} options label: accessible name of the bar
 * @returns {{ render: (state: { steps: string[], current: number, done?: boolean }) => void }}
 */
export function createStepTabs(container, { label, onGo }) {
  container.classList.add('step-tabs');
  container.setAttribute('aria-label', label);

  const list = document.createElement('ol');
  list.className = 'step-tabs__list';
  const progress = document.createElement('div');
  progress.className = 'step-tabs__progress';
  progress.setAttribute('role', 'progressbar');
  progress.setAttribute('aria-valuemin', '0');
  const fill = document.createElement('div');
  fill.className = 'step-tabs__fill';
  progress.append(fill);
  container.replaceChildren(list, progress);

  let items = [];

  function build(steps) {
    items = steps.map((text, index) => {
      const li = document.createElement('li');
      li.className = 'step-tabs__item';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'step-tabs__button';
      const badge = document.createElement('span');
      badge.className = 'step-tabs__badge';
      const name = document.createElement('span');
      name.className = 'step-tabs__label';
      button.append(badge, name);
      button.addEventListener('click', () => onGo(index + 1));
      // The connector to the next step: a line that ends in an arrow, so the order reads left to right
      const line = document.createElement('span');
      line.className = 'step-tabs__line';
      line.setAttribute('aria-hidden', 'true');
      const rule = document.createElement('span');
      rule.className = 'step-tabs__rule';
      line.append(rule, strokeIcon('step-tabs__arrow', 'M8.6 5.8C11.2 8.2 13.6 10.2 16.2 12.1C13.6 13.9 11.2 15.8 8.4 18.4'));
      li.append(button, line);
      return { li, button, badge, name, line };
    });
    list.replaceChildren(...items.map((item) => item.li));
  }

  function render({ steps, current, done = false }) {
    if (items.length !== steps.length) build(steps);
    const total = steps.length;
    steps.forEach((text, index) => {
      const n = index + 1;
      const item = items[index];
      const isCurrent = n === current && !done;
      const isDone = n < current || done;
      item.name.textContent = text;
      if (isDone && !isCurrent) {
        // A passed step shows a thin check where its number was
        item.badge.replaceChildren(strokeIcon('step-tabs__check', 'M5.2 12.9C7 14.4 8.4 15.9 9.7 17.7C12.3 13.2 15.4 9.4 19.2 6.4'));
      } else {
        item.badge.textContent = String(n);
      }
      item.button.classList.toggle('is-current', isCurrent);
      item.button.classList.toggle('is-done', isDone);
      if (isCurrent) item.button.setAttribute('aria-current', 'step');
      else item.button.removeAttribute('aria-current');
      item.line.classList.toggle('is-done', isDone);
      item.line.hidden = n === total;
    });
    // The bar reaches the middle of the current step; it fills completely only when the flow is done
    const percent = done ? 100 : Math.round(((current - 0.5) / total) * 100);
    fill.style.width = `${percent}%`;
    progress.setAttribute('aria-valuemax', String(total));
    progress.setAttribute('aria-valuenow', String(done ? total : current - 1));
  }

  return { render };
}
