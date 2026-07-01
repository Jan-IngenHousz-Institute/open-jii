"use client";

import dynamic from "next/dynamic";

import type { ExperimentDashboardWidget } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";

import { FilterWidgetView } from "./filter/filter-widget-view";
import { RichTextWidgetView } from "./rich-text/rich-text-widget";
import { TableWidgetView } from "./table/table-widget";

// Client-only: viz widgets transitively pull glslify (Plotly), which Turbopack can't SSR.
const VisualizationWidgetView = dynamic(() => import("./visualization/visualization-widget"), {
  ssr: false,
});

interface WidgetRendererProps {
  widget: ExperimentDashboardWidget;
  experimentId: string;
}

export function WidgetRenderer({ widget, experimentId }: WidgetRendererProps) {
  switch (widget.type) {
    case "visualization":
      return <VisualizationWidgetView widget={widget} experimentId={experimentId} />;
    case "richText":
      return <RichTextWidgetView widget={widget} />;
    case "table":
      return <TableWidgetView widget={widget} experimentId={experimentId} />;
    case "filter":
      return <FilterWidgetView widget={widget} experimentId={experimentId} />;
  }
}
