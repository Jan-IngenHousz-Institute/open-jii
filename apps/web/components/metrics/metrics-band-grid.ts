/**
 * One column on a phone. Two columns leave ~125px of content inside the card,
 * which shatters a long value one syllable per line; the cards earn the width
 * back by laying out as a row at that size rather than as a stack.
 */
export const metricsBandGrid = "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4";

export const metricsBandGridOfThree =
  "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3";

export const metricsBandTrendSpanOfThree = "sm:col-span-2 lg:col-span-1";

/** A three-card band: the trend takes the second row on its own. */
export const metricsBandTrendSpanWide = "sm:col-span-2";
