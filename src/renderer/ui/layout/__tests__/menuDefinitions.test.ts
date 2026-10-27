import { describe, it, expect } from 'vitest';
import { MENU_DROPDOWNS } from '../menuDefinitions';

describe('menu dropdown definitions', () => {
  const items = Object.values(MENU_DROPDOWNS).flat().filter((item) => !('separator' in item)) as Array<{ id: string; command: string }>;

  it('every item has a unique id and a command', () => {
    const ids = items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    items.forEach((item) => expect(item.command).toMatch(/^\w+\.\w+$/));
  });
});
