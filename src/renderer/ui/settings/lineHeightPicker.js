/**
 * The editor line height as cards on the settings page: every ratio shows a few lines of sample text set at that
 * ratio, so the spacing can be judged before choosing (no list to open).
 * The choices come from the options of the settings <select> (the state holder the rest of the settings code reads);
 * a card only sets that select and sends its change event.
 * Returns { rebuild, refresh }: rebuild after a language change, refresh after the value changed.
 */
import { t } from '../../core/i18n.js';

export function renderLineHeightCards(container, select) {
  let cards = [];

  const rebuild = () => {
    cards = [];
    const buttons = Array.from(select.options).map((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'theme-card line-height-card';
      button.dataset.lineHeight = option.value;

      const sample = document.createElement('span');
      sample.className = 'theme-card-sample line-height-card-sample';
      sample.setAttribute('aria-hidden', 'true');
      sample.style.lineHeight = option.value;
      sample.textContent = t('line_height_card_sample');

      const nameEl = document.createElement('span');
      nameEl.className = 'theme-card-name line-height-card-name';
      nameEl.textContent = option.textContent;

      const state = document.createElement('span');
      state.className = 'tone-card-state';
      state.textContent = t('tone_card_selected');

      button.append(sample, nameEl, state);
      button.addEventListener('click', () => {
        if (select.value === option.value) return;
        select.value = option.value;
        select.dispatchEvent(new Event('change'));
      });
      cards.push({ value: option.value, button });
      return button;
    });
    container.replaceChildren(...buttons);
    refresh();
  };

  function refresh() {
    cards.forEach(({ value, button }) => {
      button.setAttribute('aria-pressed', String(value === select.value));
    });
  }

  rebuild();
  return { rebuild, refresh };
}
