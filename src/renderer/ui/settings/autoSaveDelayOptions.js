/**
 * The pause before AutoSave, as the settings page offers it: a list of presets and a custom value in seconds or minutes.
 * Pure functions only (no DOM); the page wiring is in windowFeatureSettings.js. The stored value is always milliseconds,
 * and the allowed range lives in autoSaveManager.js (AUTO_SAVE_DELAY_RANGE_MS), so there is one place to change it.
 */

/** Values the preset list offers, in milliseconds. The first one is the app default (1.5 seconds). */
export const DELAY_PRESETS_MS = [1500, 3000, 10000, 30000, 60000, 300000, 600000, 1800000, 3600000];

/** The list entry that opens the number field. */
export const CUSTOM = 'custom';

export const UNIT_MS = { sec: 1000, min: 60000 };

/** Limits of the number field for each unit (the overall range is still enforced by autoSaveManager.js). */
export const UNIT_RANGE = {
  sec: { min: 0.5, max: 3600, step: 0.5 },
  min: { min: 1, max: 60, step: 1 }
};

/** The list value for a stored pause: the preset it equals, or the custom entry. */
export function presetValueFor(ms) {
  return DELAY_PRESETS_MS.includes(ms) ? String(ms) : CUSTOM;
}

/** How a stored pause is shown in the number field: whole minutes in minutes, anything else in seconds. */
export function splitForCustom(ms) {
  if (ms >= UNIT_MS.min && ms % UNIT_MS.min === 0) return { unit: 'min', amount: ms / UNIT_MS.min };
  return { unit: 'sec', amount: ms / UNIT_MS.sec };
}

/** The pause in milliseconds for a typed amount and unit; NaN when the amount is not a number. */
export function toMs(amount, unit) {
  const value = typeof amount === 'string' && amount.trim() === '' ? NaN : Number(amount);
  return value * (UNIT_MS[unit] ?? NaN);
}

/** The text of a preset entry, built from the translated unit names (for example "1.5 s" or "5 min"). */
export function formatDelayLabel(ms, unitNames) {
  return ms >= UNIT_MS.min ? `${ms / UNIT_MS.min} ${unitNames.min}` : `${ms / UNIT_MS.sec} ${unitNames.sec}`;
}
