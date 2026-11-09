/**
 * Theme choice as sample cards: a small editor sample in each theme's own colours, in a grid.
 * Used by the first-run setup and by the settings page, so both show the same cards.
 *
 * The caller decides what a click does and what counts as "current"; this part only draws and marks the pressed card.
 */
import { getThemePreview, hasBothFaces, isDarkModeActive } from '../../editor/core/themeLoader.js';
import { t } from '../../core/i18n';

/** The custom card is a background and text colour pair, not a theme: it overrides the editor canvas of the selected theme. */
export const CUSTOM_CARD = 'custom';

function sampleLine(widths, colors) {
  const line = document.createElement('span');
  line.className = 'theme-card-line';
  widths.forEach((width, i) => {
    const bar = document.createElement('i');
    bar.style.width = width;
    bar.style.background = colors[i];
    line.append(bar);
  });
  return line;
}

/**
 * Draws one card per theme, then the custom card, into container.
 *
 * options:
 *   themes:       theme names, in display order
 *   current:      () => the stored theme name
 *   isCustomOn:   () => true while the custom colours are the editor canvas
 *   customSample: () => { background, lineNumber, keyword, foreground, string } for the custom card
 *   onPickTheme:  (name) => void
 *   onPickCustom: () => void
 *
 * Returns { refresh }: call it when the theme or the custom switch changes, so exactly one card is pressed.
 */
export function renderThemeCards(container, options) {
  const { themes, current, isCustomOn, customSample, onPickTheme, onPickCustom } = options;
  const cards = [];

  const makeCard = (name) => {
    const isCustom = name === CUSTOM_CARD;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-card';
    button.dataset.theme = name;

    // The sample shows the face the current mode uses; a theme with both faces gets the other face as a corner
    const p = isCustom ? customSample() : getThemePreview(name);
    const other = !isCustom && hasBothFaces(name) ? getThemePreview(name, isDarkModeActive() ? 'light' : 'dark') : null;
    const sample = document.createElement('span');
    sample.className = 'theme-card-sample';
    sample.setAttribute('aria-hidden', 'true');
    sample.style.background = other
      ? `linear-gradient(135deg, ${p.background} 78%, ${other.background} 78%)`
      : p.background;
    sample.append(
      sampleLine(['6px', '28%', '40%'], [p.lineNumber, p.keyword, p.foreground]),
      sampleLine(['6px', '22%', '50%'], [p.lineNumber, p.foreground, p.string]),
      sampleLine(['6px', '45%'], [p.lineNumber, p.keyword])
    );

    const label = document.createElement('span');
    label.className = 'theme-card-name';
    label.textContent = isCustom ? t('theme_custom') : name;
    button.append(sample, label);
    button.addEventListener('click', () => (isCustom ? onPickCustom() : onPickTheme(name)));
    cards.push({ name, button });
    return button;
  };

  container.replaceChildren(...[...themes, CUSTOM_CARD].map(makeCard));

  const refresh = () => {
    const customOn = isCustomOn();
    const now = current();
    cards.forEach(({ name, button }) => {
      const pressed = name === CUSTOM_CARD ? customOn : !customOn && name === now;
      button.setAttribute('aria-pressed', String(pressed));
    });
  };
  refresh();
  return { refresh };
}

/**
 * Gives every card the width of the widest name, so the cards match in size.
 * Measured from the text itself; a hidden container has no size, so the call is skipped and the stylesheet default applies.
 */
export function fitThemeCards(container) {
  if (!container) return;
  const widths = [...container.querySelectorAll('.theme-card-name')].map((label) => {
    const range = document.createRange();
    range.selectNodeContents(label);
    return range.getBoundingClientRect().width;
  });
  const widest = Math.max(0, ...widths);
  if (widest <= 0) return;
  // card padding and border on both sides
  container.style.setProperty('--theme-card-w', `${Math.ceil(widest) + 24}px`);
}
