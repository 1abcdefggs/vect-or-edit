/**
 * A show/hide button on each settings card heading. Every card starts open; the button hides the rows of its card
 * and keeps the heading, so the card can be folded to its title. Pure view state: it is not stored, so every start
 * opens all cards again.
 */
import { t } from '../../core/i18n.js';

const CARD_SELECTOR = '.settings-section-card > h4[data-card-heading]';
let seq = 0;

function syncButton(btn, card) {
  const collapsed = card.classList.contains('is-collapsed');
  const icon = btn.querySelector('.material-symbols-outlined');
  if (icon) icon.textContent = collapsed ? 'expand_more' : 'expand_less';
  btn.setAttribute('aria-expanded', String(!collapsed));
  btn.title = t(collapsed ? 'tip_card_expand' : 'tip_card_collapse');
}

/** Adds the button to every card heading that does not have one yet. Safe to call again. */
export function initCardCollapse(root = document) {
  root.querySelectorAll(CARD_SELECTOR).forEach((heading) => {
    if (heading.querySelector(':scope > .card-collapse-btn')) return;
    const card = heading.parentElement;
    if (!card.id) card.id = `settings-card-${++seq}`;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'card-collapse-btn';
    btn.setAttribute('aria-controls', card.id);
    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined';
    icon.ariaHidden = 'true';
    btn.appendChild(icon);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      card.classList.toggle('is-collapsed');
      syncButton(btn, card);
    });
    heading.appendChild(btn);
    syncButton(btn, card);
  });
}

// The titles follow the language; the state (open or folded) does not change with it
window.addEventListener('app:languageChanged', () => {
  document.querySelectorAll('.card-collapse-btn').forEach((btn) => {
    const card = btn.closest('.settings-section-card');
    if (card) syncButton(btn, card);
  });
});
