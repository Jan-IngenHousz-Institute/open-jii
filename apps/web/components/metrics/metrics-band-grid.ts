/**
 * The metrics band's grid, and the span its trend card takes.
 *
 * Two columns from the smallest width rather than one: four stacked cards ran
 * ~500px, so on a list page the search field and the table it belongs to were
 * both below the fold. `FleetOverviewDashboard` already pairs its tiles this
 * way, so this is the shape the platform reads as a metrics strip.
 *
 * Exported because the band is drawn in three places (resource lists, the
 * dashboard, the experiment overview) plus the skeleton that has to match it
 * exactly, and each had re-derived the string. The skeleton diverging is a
 * visible reflow the moment the figures arrive.
 */
export const metricsBandGrid = "grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4";

/** The same band with three cards rather than four. */
export const metricsBandGridOfThree =
  "grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3";

/**
 * The trend card carries a sparkline, so it keeps the full width on a phone
 * instead of being squeezed into half of one.
 */
export const metricsBandTrendSpan = "col-span-2 sm:col-span-2 xl:col-span-1";

/** The trend span inside a three-card band. */
export const metricsBandTrendSpanOfThree = "col-span-2 sm:col-span-2 lg:col-span-1";

/** The trend span when it is the only card beside the two stat cards. */
export const metricsBandTrendSpanWide = "col-span-2 sm:col-span-2";
