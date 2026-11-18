/**
 * The editor canvas tones: a background level and a text level, chosen separately, in a dark and a light family.
 * Pure data and functions (no DOM, no Monaco), so the table can be tested and changed in one place.
 *
 * PROVISIONAL COLOURS (owner, 2026-11-18): these are reasonable starting values, not evidence-based ones.
 * They are to be replaced by values with a stated basis. Change them only here (BACKGROUNDS and TEXTS below);
 * every consumer (Monaco theme, toolbar list, settings cards) reads this table.
 */

export const FAMILIES = ['dark', 'light'];
export const LEVELS = ['soft', 'crisp'];

/** Background per family and level. gutter is the line-number strip, lineNo the dim colour of the numbers. */
const BACKGROUNDS = {
  dark: {
    soft: { bg: '#1e1e2e', gutter: '#1e1e2e', lineNo: '#6c7086' },
    crisp: { bg: '#000000', gutter: '#000000', lineNo: '#475569' }
  },
  light: {
    soft: { bg: '#f5f1e8', gutter: '#ece7da', lineNo: '#8a8f98' },
    crisp: { bg: '#ffffff', gutter: '#f8fafc', lineNo: '#94a3b8' }
  }
};

/** Text colour per family and level. */
const TEXTS = {
  dark: { soft: '#cdd6f4', crisp: '#f8fafc' },
  light: { soft: '#3b4252', crisp: '#0f172a' }
};

/** The eight pairs, dark family first. key is the value stored as the editor tone. */
export const TONE_PAIRS = FAMILIES.flatMap((family) =>
  LEVELS.flatMap((bgLevel) =>
    LEVELS.map((fgLevel) => {
      const base = BACKGROUNDS[family][bgLevel];
      return {
        key: `${family}_${bgLevel}_${fgLevel}`,
        family,
        bgLevel,
        fgLevel,
        bg: base.bg,
        fg: TEXTS[family][fgLevel],
        gutter: base.gutter,
        lineNo: base.lineNo,
        isDark: family === 'dark'
      };
    })
  )
);

/** Tone values stored before the eight pairs existed. They keep working and mean the crisp / crisp pair of their family. */
export const LEGACY_TONES = {
  oled: 'dark_crisp_crisp',
  dark_oled: 'dark_crisp_crisp',
  snow: 'light_crisp_crisp',
  light_snow: 'light_crisp_crisp'
};

/** The tone as the pickers show it: a legacy value becomes its pair; anything else is returned as it is. */
export function normalizeTone(tone) {
  return LEGACY_TONES[tone] ?? tone;
}

/** The pair for a stored tone (legacy values included), or null for 'default', 'custom' and unknown values. */
export function pairFor(tone) {
  const key = normalizeTone(tone);
  return TONE_PAIRS.find((pair) => pair.key === key) ?? null;
}

function luminance(hex) {
  const h = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** WCAG contrast ratio of two #rrggbb colours (1 to 21). */
export function contrastRatio(a, b) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** True when the stored tone is a light canvas (used where text must stay readable on it). */
export function isLightTone(tone) {
  return pairFor(tone)?.isDark === false;
}

/**
 * The WCAG level a contrast ratio reaches for normal-size text: 'AAA' from 7, 'AA' from 4.5, otherwise 'below'.
 * (WCAG 2.x success criteria 1.4.6 and 1.4.3.)
 */
export function wcagLevel(ratio) {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  return 'below';
}
