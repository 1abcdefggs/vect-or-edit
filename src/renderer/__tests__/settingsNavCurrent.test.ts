import { describe, expect, it } from 'vitest';
import { pickCurrentCard, navScrollTopFor, pageEndDirection } from '../ui/settings/settingsNavCurrent.js';

describe('pickCurrentCard', () => {
  const tops = [-400, -120, 60, 500];

  it('returns -1 when there are no cards', () => {
    expect(pickCurrentCard([])).toBe(-1);
  });

  it('picks the last card whose top has reached the offset line', () => {
    // card 1 is at -120 (passed), card 2 at 60 (not yet within 24px): card 1 is current
    expect(pickCurrentCard(tops, 24, false)).toBe(1);
  });

  it('counts a card that sits exactly on the offset line as reached', () => {
    expect(pickCurrentCard([-300, 24, 300], 24, false)).toBe(1);
  });

  it('returns the first card when the body is above every card', () => {
    expect(pickCurrentCard([60, 300], 24, false)).toBe(0);
  });

  it('returns the last card when the body is scrolled to its end, even if that card cannot reach the top', () => {
    expect(pickCurrentCard([-400, -120, 60, 80], 24, true)).toBe(3);
  });

  it('follows the scroll: a card that moves past the line becomes current', () => {
    expect(pickCurrentCard([-30, 200, 400], 24, false)).toBe(0);
    expect(pickCurrentCard([-30, 200, 400].map((t) => t - 200), 24, false)).toBe(1);
  });
});

describe('navScrollTopFor', () => {
  it('keeps the position when the item is already visible', () => {
    expect(navScrollTopFor(100, 300, 150, 190)).toBe(100);
  });

  it('scrolls up so an item above the visible part shows with a margin', () => {
    expect(navScrollTopFor(100, 300, 60, 100)).toBe(52);
  });

  it('never scrolls above zero', () => {
    expect(navScrollTopFor(40, 300, 2, 30)).toBe(0);
  });

  it('scrolls down so an item below the visible part shows with a margin', () => {
    expect(navScrollTopFor(0, 300, 320, 360)).toBe(68);
  });
});

describe('pageEndDirection', () => {
  it('is none when the tab fits', () => {
    expect(pageEndDirection(0, 600, 600)).toBe('none');
    expect(pageEndDirection(0, 600, 604)).toBe('none');
  });

  it('points down at the top and up at the bottom', () => {
    expect(pageEndDirection(0, 600, 1800)).toBe('down');
    expect(pageEndDirection(1200, 600, 1800)).toBe('up');
  });

  it('switches at the middle of the scroll range', () => {
    expect(pageEndDirection(599, 600, 1800)).toBe('down');
    expect(pageEndDirection(600, 600, 1800)).toBe('up');
  });
});
