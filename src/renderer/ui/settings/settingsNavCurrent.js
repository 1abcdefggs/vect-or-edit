/**
 * Which card of the settings body is the "current" one, for the left nav.
 *
 * cardTops: the top edge of each card, measured from the top of the scrolling body (px, may be negative).
 * offset:   how far below the body's top edge a card still counts as reached (px).
 * atBottom: true when the body is scrolled to its end; the last card is then current even if it cannot reach the top.
 *
 * Returns the index of the current card, or -1 when there are no cards.
 * Kept free of DOM access so the boundary cases can be tested directly.
 */
export function pickCurrentCard(cardTops, offset = 24, atBottom = false) {
  if (!cardTops.length) return -1;
  if (atBottom) return cardTops.length - 1;
  let current = -1;
  cardTops.forEach((top, index) => {
    if (top <= offset) current = index;
  });
  // Above the first card's reach (for example, the body is scrolled to the top): the first card is current
  return current === -1 ? 0 : current;
}

/**
 * The scrollTop the left nav needs so that the current item stays inside its visible part.
 *
 * navScrollTop / navHeight: the nav's own scroll position and visible height (px).
 * itemTop / itemBottom:     the item's edges measured from the top of the nav's scrolling content (px).
 * margin:                   room kept above and below the item (px).
 *
 * Returns the unchanged scrollTop when the item is already visible, so the nav does not move needlessly.
 */
export function navScrollTopFor(navScrollTop, navHeight, itemTop, itemBottom, margin = 8) {
  if (itemTop - margin < navScrollTop) return Math.max(0, itemTop - margin);
  if (itemBottom + margin > navScrollTop + navHeight) return Math.max(0, itemBottom + margin - navHeight);
  return navScrollTop;
}

/**
 * Which way the single "go to the end" button of the settings page points.
 *
 * Returns 'none' when the tab fits without scrolling, 'down' while the body is in its upper half (the button
 * scrolls to the bottom), and 'up' from the middle on (the button scrolls back to the top).
 */
export function pageEndDirection(scrollTop, clientHeight, scrollHeight, slack = 8) {
  const range = scrollHeight - clientHeight;
  if (range <= slack) return 'none';
  return scrollTop >= range / 2 ? 'up' : 'down';
}
