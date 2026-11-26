/**
 * paneLimits.ts - the single place where the size of each side pane is described.
 *
 * Every pane that can be resized reads its default, minimum and maximum from here. The CSS keeps
 * the same numbers (variables.css, sidebar.css, editor.css); __tests__/paneLimits.test.ts fails if
 * the two drift apart. A later layout model (more panes, ratios) changes this file, not each resizer.
 */
import { LAYOUT_KEYS } from './layoutMemory.js';

export interface HorizontalPaneLimits {
  cssVar: string;
  storageKey: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  /** The pane never grows past this share of the window width. */
  maxViewportRatio: number;
}

export const SIDEBAR_PANE: HorizontalPaneLimits = {
  cssVar: '--sidebar-width',
  storageKey: LAYOUT_KEYS.sidebarWidth,
  defaultWidth: 360,
  minWidth: 320,
  maxWidth: 800,
  maxViewportRatio: 0.65
};

/** The main editor keeps at least this width (CSS: .editor-section min-width). */
export const EDITOR_MIN_WIDTH = 400;

/** Width of the splitter between the editor and a side pane (CSS: .workspace-resizer, buttons.css). */
export const PANE_RESIZER_WIDTH = 8;

/** Left and right padding of the workspace row (CSS: .workspace, utilities.css). */
export const WORKSPACE_PADDING_X = 12;

/**
 * The largest width a pane may take in a window of `viewportWidth` pixels.
 * The editor keeps EDITOR_MIN_WIDTH, the splitter its width and the row its padding on both sides,
 * so the pane gives way to them.
 */
export function maxPaneWidth(pane: HorizontalPaneLimits, viewportWidth: number): number {
  const editorRoom = viewportWidth - EDITOR_MIN_WIDTH - PANE_RESIZER_WIDTH - 2 * WORKSPACE_PADDING_X;
  return Math.min(viewportWidth * pane.maxViewportRatio, pane.maxWidth, editorRoom);
}

/**
 * Clamps a dragged, restored or window-resized width to the pane's range for the current window.
 * When the window is too narrow for the pane's minimum, the editor's room wins and the pane may go below its minimum.
 */
export function clampPaneWidth(pane: HorizontalPaneLimits, width: number, viewportWidth: number): number {
  return Math.min(maxPaneWidth(pane, viewportWidth), Math.max(pane.minWidth, width));
}

/** A stored width is used only when it lies inside the pane's fixed range. */
export function isStoredPaneWidthValid(pane: HorizontalPaneLimits, width: number): boolean {
  return width >= pane.minWidth && width <= pane.maxWidth;
}
