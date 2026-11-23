/**
 * The colour of a settings mark (the gear and the outline it draws) when the theme accent is the default.
 * It starts as the accent's inverse (RGB complement), then moves only its lightness (OKLCH L) until it reaches
 * the contrast limit against every background it sits on. Hue and chroma are kept (chroma is cut to fit the screen gamut).
 */

const MARK_MIN_CONTRAST = 3; // WCAG 1.4.11 for graphical objects

function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function linearToSrgb(v) {
  const x = Math.min(1, Math.max(0, v));
  return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
}
function luminance([r, g, b]) {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}
export function contrastOf(a, b) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function toOklab(rgb) {
  const [r, g, b] = rgb.map(srgbToLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function fromOklab([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map(linearToSrgb);
}
const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const rgbToHex = (rgb) => `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;

/**
 * @param {string} accentHex  six-digit hex of the theme accent
 * @param {string[]} backgroundsHex  every background the mark sits on
 * @returns {string} hex colour meeting the contrast limit on every background if one exists, else the plain inverse
 */
export function markColourFor(accentHex, backgroundsHex) {
  const inverse = rgbToHex(hexToRgb(accentHex).map((v) => 255 - v));
  const backgrounds = backgroundsHex.map(hexToRgb);
  if (!backgrounds.length) return inverse;
  const worst = (rgb) => Math.min(...backgrounds.map((bg) => contrastOf(rgb, bg)));
  if (worst(hexToRgb(inverse)) >= MARK_MIN_CONTRAST) return inverse;

  const [L0, a0, b0] = toOklab(hexToRgb(inverse));
  const chroma = Math.hypot(a0, b0);
  const hue = Math.atan2(b0, a0);
  // Light backgrounds take a darker mark, dark ones a lighter mark
  const step = backgrounds.every((bg) => luminance(bg) > 0.18) ? -0.002 : 0.002;
  for (let L = L0; L >= 0 && L <= 1; L += step) {
    for (let c = chroma; c >= 0; c -= 0.005) {
      const rgb = fromOklab([L, c * Math.cos(hue), c * Math.sin(hue)]);
      if (rgb.some((v) => v < -0.5 || v > 255.5)) continue; // out of the screen gamut: less chroma
      const clipped = rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))));
      if (worst(clipped) >= MARK_MIN_CONTRAST) return rgbToHex(clipped);
      break;
    }
  }
  return inverse;
}
