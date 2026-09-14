/**
 * A swipeable rail on a phone, a grid from `sm` up.
 *
 * One row of full-size tiles rather than four stacked ones: the band is a
 * summary, and stacking it pushed the page's actual content below the fold.
 * The next tile peeks at 86% so there is always an edge showing to swipe.
 *
 * Sized through a child selector so a caller passes its cards straight in and
 * their `sm:col-span-*` keeps landing on the grid item itself.
 */
const bandRail =
  "flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [&>*]:shrink-0 [&>*]:basis-[86%] [&>*]:snap-start sm:grid sm:gap-4 sm:overflow-visible sm:[&>*]:basis-auto";

export const metricsBandGrid = `${bandRail} sm:grid-cols-2 xl:grid-cols-4`;

export const metricsBandGridOfThree = `${bandRail} sm:grid-cols-2 lg:grid-cols-3`;

export const metricsBandTrendSpanOfThree = "sm:col-span-2 lg:col-span-1";

/** A three-card band: the trend takes the second row on its own. */
export const metricsBandTrendSpanWide = "sm:col-span-2";
