/**
 * Where the zoom popup goes while the page is being zoomed, so that it stays still on screen.
 *
 * Zooming scales the whole page, so an element that is not moved drifts away from a still pointer.
 * The anchor is the popup's screen position (in zoom-free units: CSS px x zoom factor) taken when the gesture starts.
 * For a later factor the popup gets a fixed CSS position and a counter-scale, so it keeps its place and its size.
 */
export interface HintAnchor {
  /** Left and top edge at the anchor factor, in CSS px multiplied by that factor. */
  left: number;
  top: number;
  /** The zoom factor when the anchor was taken. */
  factor: number;
}

export interface HintPlacement {
  /** CSS px for the fixed position. */
  left: number;
  top: number;
  /** Counter-scale: keeps the popup's on-screen size equal to its size at the anchor factor. */
  scale: number;
}

export function frozenHintPlacement(anchor: HintAnchor, factor: number): HintPlacement {
  return {
    left: anchor.left / factor,
    top: anchor.top / factor,
    scale: anchor.factor / factor,
  };
}
