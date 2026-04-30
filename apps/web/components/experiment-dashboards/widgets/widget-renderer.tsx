"use client";

import type { DashboardWidget } from "@repo/api/schemas/experiment.schema";

import { RichTextWidgetView } from "./rich-text-widget";
import { RichTextWidgetEditor } from "./rich-text-widget-editor";
import { VisualizationWidgetView } from "./visualization-widget";
import { VisualizationWidgetEditor } from "./visualization-widget-editor";

interface WidgetRendererProps {
  widget: DashboardWidget;
  experimentId: string;
}

interface EditableWidgetRendererProps extends WidgetRendererProps {
  widgetIndex: number;
  isSelected: boolean;
  onRemove: () => void;
}

/**
 * Read-only dispatch — used by `<DashboardRenderer>` (overview slider,
 * detail page). Adding a new widget type means adding a Zod schema entry
 * and a case here.
 */
export function WidgetRenderer({ widget, experimentId }: WidgetRendererProps) {
  switch (widget.type) {
    case "visualization":
      return <VisualizationWidgetView widget={widget} experimentId={experimentId} />;
    case "richText":
      return <RichTextWidgetView widget={widget} />;
  }
}

/**
 * Editor dispatch — used inside `<DashboardCanvas>`. Each editable variant
 * owns its own inline controls (picker, kebab) so all configuration lives
 * inside the widget; no side panel.
 */
export function WidgetEditor({
  widget,
  experimentId,
  widgetIndex,
  isSelected,
  onRemove,
}: EditableWidgetRendererProps) {
  switch (widget.type) {
    case "visualization":
      return (
        <VisualizationWidgetEditor
          widget={widget}
          experimentId={experimentId}
          widgetIndex={widgetIndex}
          onRemove={onRemove}
        />
      );
    case "richText":
      return (
        <RichTextWidgetEditor
          widget={widget}
          widgetIndex={widgetIndex}
          isSelected={isSelected}
          onRemove={onRemove}
        />
      );
  }
}
