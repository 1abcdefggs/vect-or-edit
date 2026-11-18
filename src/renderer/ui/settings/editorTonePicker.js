/**
 * The editor canvas choice (background and text colours) as the user sees it:
 *  - cards on the settings page: a Theme row (match the theme, custom colours), then a Dark and a Light row of four pairs;
 *    each pair card shows its sample, its names, its contrast ratio and the WCAG level the ratio reaches
 *  - the list in the toolbar (the same choices, in a narrow select)
 * The two <select> elements (settings and toolbar) stay the state holders the rest of the settings code already reads;
 * a card only sets the settings select and sends its change event. The colours come from editorTonePairs.js.
 */
import { t } from '../../core/i18n.js';
import { readStorage } from '../../core/storage.js';
import { STORAGE_KEYS } from '../../core/constants.js';
import { getStoredThemeSetting, getThemePreview } from '../../editor/core/themeLoader.js';
import { FAMILIES, TONE_PAIRS, contrastRatio, normalizeTone, wcagLevel } from '../../editor/core/editorTonePairs.js';

const DEFAULT_TONE = 'default';
const CUSTOM_TONE = 'custom';

const levelName = (level) => t(`tone_level_${level}`);
const familyName = (family) => t(`tone_family_${family}`);

/** "BG Soft / Text Crisp": the two choices of a pair, in words. */
export function toneLabel(pair) {
  return t('tone_label', { bg: levelName(pair.bgLevel), fg: levelName(pair.fgLevel) });
}

/** The contrast text of a pair or of the custom colours ({ bg, fg }), for example "11.3 : 1  AAA". */
export function contrastText(pair) {
  const ratio = contrastRatio(pair.bg, pair.fg);
  const level = wcagLevel(ratio);
  return `${ratio.toFixed(1)} : 1  ${level === 'below' ? t('tone_wcag_below') : level}`;
}

/** The choices of the toolbar list: default, the eight pairs under Dark and Light, custom. Keeps the chosen value. */
export function fillToneSelect(select, defaultKey = 'tone_default') {
  if (!select) return;
  const chosen = select.value;
  const groups = FAMILIES.map((family) => {
    const group = document.createElement('optgroup');
    group.label = familyName(family);
    TONE_PAIRS.filter((pair) => pair.family === family).forEach((pair) => {
      const option = new Option(t('tone_option', { family: familyName(family), label: toneLabel(pair) }), pair.key);
      group.append(option);
    });
    return group;
  });
  select.replaceChildren(new Option(t(defaultKey), DEFAULT_TONE), ...groups, new Option(t('theme_custom'), CUSTOM_TONE));
  select.value = chosen || DEFAULT_TONE;
}

function sampleOf({ bg, fg }) {
  const sample = document.createElement('span');
  sample.className = 'theme-card-sample tone-card-sample';
  sample.setAttribute('aria-hidden', 'true');
  sample.style.background = bg;
  sample.style.color = fg;
  sample.textContent = t('tone_sample_text');
  return sample;
}

/**
 * Draws the cards into container and keeps exactly one pressed.
 *
 * options:
 *   getTone:   () => the current tone value ('default', 'custom', a pair key or an old stored value)
 *   onPick:    (tone) => void
 *   statusEl:  the text line that says whether the theme or the chosen colours are in charge
 * Returns { rebuild, refresh }: rebuild after a language change, refresh after the tone or the theme changed.
 */
export function renderToneCards(container, options) {
  const { getTone, onPick, statusEl } = options;
  let cards = [];

  const makeCard = ({ tone, sample, name, contrast }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-card tone-card';
    button.dataset.tone = tone;
    const nameEl = document.createElement('span');
    nameEl.className = 'theme-card-name tone-card-name';
    nameEl.textContent = name;
    const state = document.createElement('span');
    state.className = 'tone-card-state';
    state.textContent = t('tone_card_selected');
    button.append(sample, nameEl);
    if (contrast) {
      const ratioEl = document.createElement('span');
      ratioEl.className = 'tone-card-contrast';
      ratioEl.textContent = contrast;
      button.append(ratioEl);
    }
    button.append(state);
    button.addEventListener('click', () => onPick(tone));
    cards.push({ tone, button });
    return button;
  };

  const group = (title, buttons) => {
    const wrap = document.createElement('div');
    wrap.className = 'tone-group';
    const heading = document.createElement('span');
    heading.className = 'tone-group-title';
    heading.textContent = title;
    const row = document.createElement('div');
    row.className = 'tone-card-row';
    row.append(...buttons);
    wrap.append(heading, row);
    return wrap;
  };

  const legend = () => {
    const box = document.createElement('div');
    box.className = 'tone-legend setting-desc';
    ['tone_legend_ratio', 'tone_legend_aa', 'tone_legend_aaa'].forEach((key) => {
      const line = document.createElement('p');
      line.textContent = t(key);
      box.append(line);
    });
    return box;
  };

  const rebuild = () => {
    cards = [];
    const themeSample = (() => {
      const p = getThemePreview(getStoredThemeSetting());
      return { bg: p.background, fg: p.foreground };
    })();
    const customSample = {
      bg: readStorage(STORAGE_KEYS.CUSTOM_EDITOR_BG) || '#1e1e2e',
      fg: readStorage(STORAGE_KEYS.CUSTOM_EDITOR_FG) || '#cdd6f4'
    };
    const themeRow = group(t('tone_group_theme'), [
      makeCard({ tone: DEFAULT_TONE, sample: sampleOf(themeSample), name: t('tone_card_default') }),
      makeCard({
        tone: CUSTOM_TONE,
        sample: sampleOf(customSample),
        name: t('theme_custom'),
        contrast: contrastText(customSample)
      })
    ]);
    const familyRows = FAMILIES.map((family) =>
      group(
        familyName(family),
        TONE_PAIRS.filter((pair) => pair.family === family).map((pair) =>
          makeCard({ tone: pair.key, sample: sampleOf(pair), name: toneLabel(pair), contrast: contrastText(pair) })
        )
      )
    );
    container.replaceChildren(legend(), themeRow, ...familyRows);
    refresh();
  };

  function refresh() {
    const tone = normalizeTone(getTone() || DEFAULT_TONE);
    cards.forEach(({ tone: cardTone, button }) => {
      button.setAttribute('aria-pressed', String(cardTone === tone));
    });
    if (statusEl) {
      const overriding = tone !== DEFAULT_TONE;
      statusEl.textContent = t(overriding ? 'tone_status_override' : 'tone_status_theme');
      statusEl.classList.toggle('is-override', overriding);
    }
  }

  rebuild();
  return { rebuild, refresh };
}

