import { describe, expect, it } from 'vitest';
import { BULLET_TIP_KEYS, formatTipText } from '../tipFormat';

const STOP = String.fromCharCode(0x3002);
const COMMA = String.fromCharCode(0x3001);
const BULLET = String.fromCharCode(0x30fb);

describe('formatTipText', () => {
  it('puts each sentence after the first of a listed key on its own bulleted line', () => {
    const input = `one${STOP}two${STOP}three${STOP}`;
    expect(formatTipText('tip_header_theme', input)).toBe(`one${STOP}\n${BULLET}two${STOP}\n${BULLET}three${STOP}`);
  });

  it('does not break a sentence at a comma', () => {
    const input = `a${COMMA}b${COMMA}c`;
    expect(formatTipText('tip_header_theme', input)).toBe(input);
  });

  it('keeps a single sentence with a trailing full stop on one line', () => {
    expect(formatTipText('tip_vis_locked', `one${STOP}`)).toBe(`one${STOP}`);
  });

  it('leaves a key that is not listed as it is', () => {
    const input = `edit\nundo${STOP}redo`;
    expect(formatTipText('tip_menu_edit', input)).toBe(input);
  });

  it('keeps empty text unchanged for a listed key', () => {
    expect(formatTipText('tip_vis_locked', '')).toBe('');
  });

  it('lists exactly the keys that were agreed', () => {
    expect(BULLET_TIP_KEYS.size).toBe(15);
  });
});
