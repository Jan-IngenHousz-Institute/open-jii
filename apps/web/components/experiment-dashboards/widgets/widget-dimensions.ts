import type { DashboardWidget } from "@repo/api/schemas/experiment.schema";

interface WidgetDimensionConstraints {
  minW: number;
  minH: number;
  maxH?: number;
  defaultW?: number;
  defaultH?: number;
}

export function getWidgetMinDimensions(type: DashboardWidget["type"]): WidgetDimensionConstraints {
  switch (type) {
    case "visualization":
      return { minW: 3, minH: 4 };
    case "richText":
      return { minW: 2, minH: 2 };
    case "table":
      return { minW: 4, minH: 3, maxH: 8 };
    case "filter":
      return { minW: 2, minH: 2, maxH: 3, defaultW: 3, defaultH: 2 };
  }
}
