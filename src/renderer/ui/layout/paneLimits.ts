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
export const EDITOR_MIN_WIDTH = 320;

/** The largest width a pane may take in a window of `viewportWidth` pixels. */
export function maxPaneWidth(pane: HorizontalPaneLimits, viewportWidth: number): number {
  return Math.min(viewportWidth * pane.maxViewportRatio, pane.maxWidth);
}

/** Clamps a dragged or restored width to the pane's range for the current window. */
export function clampPaneWidth(pane: HorizontalPaneLimits, width: number, viewportWidth: number): number {
  return Math.max(pane.minWidth, Math.min(maxPaneWidth(pane, viewportWidth), width));
}

/** A stored width is used only when it lies inside the pane's fixed range. */
export function isStoredPaneWidthValid(pane: HorizontalPaneLimits, width: number): boolean {
  return width >= pane.minWidth && width <= pane.maxWidth;
}
