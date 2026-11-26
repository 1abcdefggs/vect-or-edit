import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EDITOR_MIN_WIDTH, PANE_RESIZER_WIDTH, SIDEBAR_PANE, WORKSPACE_PADDING_X, clampPaneWidth, isStoredPaneWidthValid, maxPaneWidth } from '../paneLimits';

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
    expect(maxPaneWidth(SIDEBAR_PANE, 1000)).toBe(552);
    expect(maxPaneWidth(SIDEBAR_PANE, 3000)).toBe(800);
  });

  it('clamps a width to the range for the current window', () => {
    expect(clampPaneWidth(SIDEBAR_PANE, 100, 1280)).toBe(320);
    expect(clampPaneWidth(SIDEBAR_PANE, 900, 1280)).toBe(800);
    expect(clampPaneWidth(SIDEBAR_PANE, 500, 800)).toBe(352);
    expect(clampPaneWidth(SIDEBAR_PANE, 200, 800)).toBe(320);
  });

  it('leaves the editor its minimum, the splitter and the row padding when the window narrows', () => {
    // 800 - 416 (editor) - 8 (splitter) - 2 x 12 (row padding) = 352 is the room left, below the sidebar's 520 ratio cap
    expect(maxPaneWidth(SIDEBAR_PANE, 800)).toBe(352);
    expect(clampPaneWidth(SIDEBAR_PANE, 800, 800)).toBe(352);
    // A window too narrow for the sidebar minimum: the editor's room wins
    expect(clampPaneWidth(SIDEBAR_PANE, 360, 600)).toBe(152);
  });

  it('keeps the row padding in the CSS equal to WORKSPACE_PADDING_X', () => {
    const block = css('utilities.css').match(/\.workspace \{[^}]*\}/)?.[0] ?? '';
    expect(block).toContain(`padding: 8px ${WORKSPACE_PADDING_X}px`);
  });

  it('keeps the splitter width in the CSS equal to PANE_RESIZER_WIDTH', () => {
    const block = css('buttons.css').match(/\.workspace-resizer \{[^}]*\}/)?.[0] ?? '';
    expect(block).toContain(`width: ${PANE_RESIZER_WIDTH}px`);
  });

  it('keeps a restored wide width once the window is wide enough again', () => {
    expect(clampPaneWidth(SIDEBAR_PANE, 800, 800)).toBe(352);
    expect(clampPaneWidth(SIDEBAR_PANE, 800, 1280)).toBe(800);
  });

  it('uses a stored width only inside the fixed range', () => {
    expect(isStoredPaneWidthValid(SIDEBAR_PANE, 360)).toBe(true);
    expect(isStoredPaneWidthValid(SIDEBAR_PANE, 300)).toBe(false);
    expect(isStoredPaneWidthValid(SIDEBAR_PANE, 900)).toBe(false);
  });
});
