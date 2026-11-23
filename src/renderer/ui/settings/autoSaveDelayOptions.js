/**
 * The pause before AutoSave, as the settings page offers it: a list of presets and a custom value typed as m:ss.
 * Pure functions only (no DOM); the page wiring is in windowFeatureSettings.js. The stored value is always milliseconds,
 * and the allowed range lives in autoSaveManager.js (AUTO_SAVE_DELAY_RANGE_MS), so there is one place to change it.
 */

/** Values the preset list offers, in milliseconds. The first one is the app default (1.5 seconds). */
export const DELAY_PRESETS_MS = [1500, 3000, 5000, 10000, 30000, 60000, 300000, 600000, 1800000, 3600000];

/** The list entry that opens the typed field. */
export const CUSTOM = 'custom';

export const UNIT_MS = { sec: 1000, min: 60000 };

/** The list value for a stored pause: the preset it equals, or the custom entry. */
export function presetValueFor(ms) {
  return DELAY_PRESETS_MS.includes(ms) ? String(ms) : CUSTOM;
}

/** The number on a preset button: minutes for a whole minute or more, seconds otherwise. The row heading names the unit. */
export function formatDelayAmount(ms) {
  return String(ms >= UNIT_MS.min ? ms / UNIT_MS.min : ms / UNIT_MS.sec);
}

/** The typed field's text for a stored pause: "10:30" for 10 minutes 30 seconds, "0:01.5" for 1.5 seconds. */
export function formatClock(ms) {
  const tenths = Math.round(ms / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = (tenths % 600) / 10;
  const secondsText = Number.isInteger(seconds) ? String(seconds).padStart(2, '0') : seconds.toFixed(1).padStart(4, '0');
  return `${minutes}:${secondsText}`;
}

/**
 * The pause in milliseconds for a typed m:ss value ("10:30", "0:01.5", or plain seconds such as "1.5" or "90").
 * Only a dot is a decimal point. Returns NaN when the text is not a value of that form, or when seconds are 60 or more after a colon.
 */
export function parseClock(text) {
  const match = /^(?:(\d+):)?(\d+(?:\.\d+)?)$/.exec(String(text).trim());
  if (!match) return NaN;
  const [, minutesText, secondsText] = match;
  const seconds = Number(secondsText);
  if (minutesText !== undefined && seconds >= 60) return NaN;
  return Math.round((Number(minutesText ?? 0) * UNIT_MS.min + seconds * UNIT_MS.sec));
}
