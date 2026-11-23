import { describe, expect, it } from 'vitest';
import { frozenHintPlacement } from '../ui/zoomHintPlacement.js';

describe('frozenHintPlacement', () => {
  // The popup was at screen position (300, 120) when the zoom was 1.1
  const anchor = { left: 300 * 1.1, top: 120 * 1.1, factor: 1.1 };

  it.each([0.5, 1, 1.1, 3])('keeps the screen position at factor %s', (factor) => {
    const p = frozenHintPlacement(anchor, factor);
    // screen position = CSS position x factor
    expect(p.left * factor).toBeCloseTo(300 * 1.1, 6);
    expect(p.top * factor).toBeCloseTo(120 * 1.1, 6);
  });

  it.each([0.5, 1, 1.1, 3])('keeps the screen size at factor %s', (factor) => {
    const p = frozenHintPlacement(anchor, factor);
    // a box of width w (CSS px) at the anchor factor is w * anchor.factor on screen; here scale * factor must equal anchor.factor
    expect(p.scale * factor).toBeCloseTo(1.1, 6);
  });

  it('is the identity at the anchor factor', () => {
    const p = frozenHintPlacement(anchor, 1.1);
    expect(p.left).toBeCloseTo(300, 6);
    expect(p.top).toBeCloseTo(120, 6);
    expect(p.scale).toBeCloseTo(1, 6);
  });
});
