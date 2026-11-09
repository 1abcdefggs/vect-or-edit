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
