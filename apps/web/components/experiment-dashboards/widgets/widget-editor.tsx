"use client";

import dynamic from "next/dynamic";

import type { ExperimentDashboardWidget } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";

import { FilterWidgetEditor } from "./filter/filter-widget-editor";
import { RichTextWidgetEditor } from "./rich-text/rich-text-widget-editor";
import { TableWidgetEditor } from "./table/table-widget-editor";

// Client-only: viz widgets transitively pull glslify (Plotly), which Turbopack can't SSR.
const VisualizationWidgetEditor = dynamic(
  () => import("./visualization/visualization-widget-editor"),
  {
    ssr: false,
  },
);

interface WidgetEditorProps {
  widget: ExperimentDashboardWidget;
  experimentId: string;
  widgetIndex: number;
  isSelected: boolean;
}

export function WidgetEditor({ widget, experimentId, widgetIndex, isSelected }: WidgetEditorProps) {
  switch (widget.type) {
    case "visualization":
      return <VisualizationWidgetEditor widget={widget} experimentId={experimentId} />;
    case "richText":
      return (
        <RichTextWidgetEditor widget={widget} widgetIndex={widgetIndex} isSelected={isSelected} />
      );
    case "table":
      return <TableWidgetEditor widget={widget} experimentId={experimentId} />;
    case "filter":
      return (
        <FilterWidgetEditor widget={widget} experimentId={experimentId} widgetIndex={widgetIndex} />
      );
  }
}
