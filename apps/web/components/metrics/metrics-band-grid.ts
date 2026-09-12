/**
 * The metrics band's grid, and the spans its trend card takes.
 *
 * Two columns from the smallest width rather than one: four stacked cards run
 * ~500px, which puts a list page's search field and table below the fold. The
 * skeleton has to carry the same string or the page reflows when figures land.
 */
export const metricsBandGrid = "grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4";

/** The same band with three cards rather than four. */
export const metricsBandGridOfThree =
  "grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3";

/** The trend card carries a sparkline, so it keeps full width on a phone. */
export const metricsBandTrendSpan = "col-span-2 sm:col-span-2 xl:col-span-1";

/** The trend span inside a three-card band. */
export const metricsBandTrendSpanOfThree = "col-span-2 sm:col-span-2 lg:col-span-1";

/** The trend span when it is the only card beside the two stat cards. */
export const metricsBandTrendSpanWide = "col-span-2 sm:col-span-2";
