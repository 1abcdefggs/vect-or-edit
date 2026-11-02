import { describe, expect, it } from 'vitest';
import { BULLET_TIP_KEYS, formatTipText } from '../tipFormat';

describe('formatTipText', () => {
  it('puts each 、 of a listed key on its own bulleted line', () => {
    expect(formatTipText('tip_header_theme', 'theme\u3001light\u3001dark')).toBe('theme\n\u30fblight\n\u30fbdark');
  });

  it('leaves a key that is not listed as it is', () => {
    expect(formatTipText('tip_menu_edit', 'edit\nundo\u3001redo')).toBe('edit\nundo\u3001redo');
  });

  it('keeps text without 、 unchanged for a listed key', () => {
    expect(formatTipText('tip_vis_locked', '')).toBe('');
  });

  it('lists exactly the keys that were agreed', () => {
    expect(BULLET_TIP_KEYS.size).toBe(15);
  });
});
