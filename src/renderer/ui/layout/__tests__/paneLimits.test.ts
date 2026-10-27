import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EDITOR_MIN_WIDTH, SIDEBAR_PANE, clampPaneWidth, isStoredPaneWidthValid, maxPaneWidth } from '../paneLimits';

const css = (name: string) => readFileSync(resolve(process.cwd(), 'src/renderer/css', name), 'utf8');

describe('paneLimits', () => {
  it('keeps the CSS default of the sidebar width equal to the TypeScript default', () => {
    const match = css('variables.css').match(/--sidebar-width:\s*(\d+)px/);
    expect(Number(match?.[1])).toBe(SIDEBAR_PANE.defaultWidth);
  });

  it('keeps the CSS min and max of the sidebar equal to the TypeScript limits', () => {
    const block = css('sidebar.css').match(/\.suggestion-sidebar \{[^}]*\}/)?.[0] ?? '';
    expect(block).toContain(`min-width: ${SIDEBAR_PANE.minWidth}px`);
    expect(block).toContain(`max-width: ${SIDEBAR_PANE.maxWidth}px`);
  });

  it('keeps the CSS minimum of the editor equal to EDITOR_MIN_WIDTH', () => {
    const block = css('editor.css').match(/\.editor-section \{[^}]*\}/)?.[0] ?? '';
    expect(block).toContain(`min-width: ${EDITOR_MIN_WIDTH}px`);
  });

  it('caps the pane at the viewport ratio and the fixed maximum, whichever is smaller', () => {
    expect(maxPaneWidth(SIDEBAR_PANE, 1000)).toBe(650);
    expect(maxPaneWidth(SIDEBAR_PANE, 3000)).toBe(800);
  });

  it('clamps a width to the range for the current window', () => {
    expect(clampPaneWidth(SIDEBAR_PANE, 100, 1280)).toBe(320);
    expect(clampPaneWidth(SIDEBAR_PANE, 900, 1280)).toBe(800);
    expect(clampPaneWidth(SIDEBAR_PANE, 500, 800)).toBe(500);
    expect(clampPaneWidth(SIDEBAR_PANE, 200, 800)).toBe(320);
  });

  it('uses a stored width only inside the fixed range', () => {
    expect(isStoredPaneWidthValid(SIDEBAR_PANE, 360)).toBe(true);
    expect(isStoredPaneWidthValid(SIDEBAR_PANE, 300)).toBe(false);
    expect(isStoredPaneWidthValid(SIDEBAR_PANE, 900)).toBe(false);
  });
});
