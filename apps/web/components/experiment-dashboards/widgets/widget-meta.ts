import { BarChart3, Filter, Table2, Type } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { DashboardWidget } from "@repo/api/schemas/experiment.schema";

import type { DashboardTool } from "../editor/context/dashboard-editor-context";

export interface WidgetMeta {
  icon: LucideIcon;
  labelKey: string;
}

export type PlacementTool = Exclude<DashboardTool, "cursor">;

const META_BY_TYPE: Record<DashboardWidget["type"], WidgetMeta> = {
  visualization: { icon: BarChart3, labelKey: "editor.widgetTypes.visualization" },
  table: { icon: Table2, labelKey: "editor.widgetTypes.table" },
  filter: { icon: Filter, labelKey: "editor.widgetTypes.filter" },
  richText: { icon: Type, labelKey: "editor.widgetTypes.richText" },
};

const TOOL_TO_WIDGET_TYPE: Record<PlacementTool, DashboardWidget["type"]> = {
  chart: "visualization",
  text: "richText",
  table: "table",
  filter: "filter",
};

export function widgetMetaFor(type: DashboardWidget["type"]): WidgetMeta {
  return META_BY_TYPE[type];
}

export function widgetTypeForTool(tool: PlacementTool): DashboardWidget["type"] {
  return TOOL_TO_WIDGET_TYPE[tool];
}

export function widgetMetaForTool(tool: PlacementTool): WidgetMeta {
  return widgetMetaFor(widgetTypeForTool(tool));
}
