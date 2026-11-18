/**
 * The editor font family as cards on the settings page: every typeface is visible from the start,
 * drawn in its own face, with its name and a short description (no list to open).
 * The choices come from the options of the settings <select> (the state holder the rest of the settings code reads);
 * a card only sets that select and sends its change event.
 */
import { t } from '../../core/i18n.js';

// The description of each choice is looked up by the first family name in the option value.
const DESCRIPTION_KEYS = {
  'Source Serif 4': 'font_card_desc_serif',
  'Source Sans 3': 'font_card_desc_sans',
  'Source Code Pro': 'font_card_desc_mono'
};

function firstFamily(value) {
  return String(value).split(',')[0].trim().replace(/^['"]|['"]$/g, '');
}

/**
 * Draws the cards into container for the options of select and keeps exactly one pressed.
 * Returns { rebuild, refresh }: rebuild after a language change, refresh after the value changed.
 */
export function renderFontCards(container, select, { onRemove } = {}) {
  let cards = [];

  const rebuild = () => {
    cards = [];
    const buttons = Array.from(select.options).map((option) => {
      const name = option.dataset.userFont ? option.textContent : firstFamily(option.value);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'theme-card font-card';
      button.dataset.font = option.value;

      const sample = document.createElement('span');
      sample.className = 'theme-card-sample font-card-sample';
      sample.setAttribute('aria-hidden', 'true');
      sample.style.fontFamily = option.value;
      sample.textContent = t('font_card_sample');

      const nameEl = document.createElement('span');
      nameEl.className = 'theme-card-name font-card-name';
      nameEl.textContent = name;

      const userFile = option.dataset.userFont;
      const descKey = userFile ? 'font_card_desc_user' : DESCRIPTION_KEYS[name];
      const desc = document.createElement('span');
      desc.className = 'font-card-desc';
      if (descKey) desc.textContent = t(descKey);

      const state = document.createElement('span');
      state.className = 'tone-card-state';
      state.textContent = t('tone_card_selected');

      button.append(sample, nameEl, desc, state);
      let cell = button;
      if (userFile && onRemove) {
        // A button cannot hold a button, so the card sits in a wrapper with the remove button beside it
        cell = document.createElement('div');
        cell.className = 'font-card-cell';
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'settings-btn font-card-remove';
        remove.textContent = t('font_remove_btn');
        remove.title = t('tip_font_remove', { name });
        remove.addEventListener('click', () => onRemove(userFile));
        cell.append(button, remove);
      }
      button.addEventListener('click', () => {
        if (select.value === option.value) return;
        select.value = option.value;
        select.dispatchEvent(new Event('change'));
      });
      cards.push({ value: option.value, button });
      return cell;
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
