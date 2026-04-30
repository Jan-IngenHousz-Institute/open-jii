import type { DashboardWidget } from "@repo/api/schemas/experiment.schema";

interface WidgetMinDimensions {
  minW: number;
  minH: number;
}

/**
 * Per-type floor for widget size on the dashboard grid. Visualizations need
 * enough room for axes + a legend; rich-text only needs to fit a line of
 * formatted prose. Used both as RGL's `minW`/`minH` (so resize handles
 * can't drag past these) and as the seed size for newly-added widgets.
 */
export function getWidgetMinDimensions(type: DashboardWidget["type"]): WidgetMinDimensions {
  switch (type) {
    case "visualization":
      return { minW: 3, minH: 4 };
    case "richText":
      return { minW: 2, minH: 2 };
  }
}
