import { describe, it, expect } from 'vitest';
import { deriveTextColours, blendOver, TEXT_CONTRAST } from '../derivedColors.js';
import { contrastRatio, mixColors } from '../themeSkeleton.js';

describe('deriveTextColours', () => {
  // A light face whose accent is pale: the design colour (35% toward the text) would be too faint on the tint
  const palette = { bg: '#ffffff', fg: '#111111', panel: '#f6f8fa', accent: '#f0d060', isLight: true };

  it('item code text reaches the contrast limit on its tint', () => {
    const d = deriveTextColours(palette);
    expect(contrastRatio(d.itemCodeText, d.itemCodeSurface)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
  });

  it('keeps the design colour when it already passes', () => {
    // Dark face, strong accent: the first candidate (35% toward the text) already passes
    const d = deriveTextColours({ bg: '#1e1e1e', fg: '#ffffff', panel: '#252526', accent: '#2563eb', isLight: false });
    expect(d.itemCodeText).toBe(mixColors('#2563eb', '#ffffff', 0.35));
    expect(contrastRatio(d.itemCodeText, d.itemCodeSurface)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
  });

  it('log muted text fits the log body, moving toward the text colour only when needed', () => {
    const d = deriveTextColours(palette);
    expect(contrastRatio(d.logMuted, palette.bg)).toBeGreaterThanOrEqual(TEXT_CONTRAST);
  });

  it('log header falls back to the editor background when the text colour fails on the tinted header', () => {
    // Text colour close to the background: the 6% header tint pushes it below the limit
    const d = deriveTextColours({ bg: '#ffffff', fg: '#7a7a7a', panel: '#ffffff', accent: '#2563eb', isLight: true });
    expect(d.logHeader).toBe('#ffffff');
  });

  it('blendOver composites an alpha colour over a surface', () => {
    expect(blendOver('#000000', 0.5, '#ffffff')).toBe('#808080');
  });
});
