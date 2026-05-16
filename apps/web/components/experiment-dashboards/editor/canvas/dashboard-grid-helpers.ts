import { verticalCompactor } from "react-grid-layout";
import type { LayoutItem, ResizeHandleAxis } from "react-grid-layout";

import type { DashboardWidget } from "@repo/api/schemas/experiment.schema";

import { getWidgetMinDimensions } from "../../widgets/widget-dimensions";
import type { DashboardTool } from "../context/dashboard-editor-context";

export const RESIZE_HANDLES: ResizeHandleAxis[] = ["s", "w", "e", "n", "sw", "nw", "se", "ne"];

// Pseudo-widget id RGL renders alongside real ones; persistLayout filters it out.
export const PLACEMENT_GHOST_ID = "__placement_ghost__";

// Interactive children that must keep working while the card chrome is draggable.
export const DRAG_CANCEL_SELECTOR = [
  ".js-plotly-plot",
  ".ProseMirror",
  '[contenteditable="true"]',
  "button",
  "a[href]",
  "input",
  "textarea",
  "select",
  "[data-no-drag]",
].join(", ");

export function widgetTypeForTool(tool: DashboardTool): DashboardWidget["type"] | null {
  if (tool === "cursor") {
    return null;
  }
  if (tool === "chart") {
    return "visualization";
  }
  if (tool === "text") {
    return "richText";
  }
  if (tool === "table") {
    return "table";
  }
  return "filter";
}

export function defaultWidgetSize(
  type: DashboardWidget["type"],
  columns: number,
): { colSpan: number; rowSpan: number } {
  const { minW, minH, defaultW, defaultH } = getWidgetMinDimensions(type);
  const desiredW = defaultW ?? Math.max(minW, 6);
  const desiredH = defaultH ?? Math.max(minH, 4);
  return {
    colSpan: Math.min(desiredW, Math.max(1, columns)),
    rowSpan: desiredH,
  };
}

export function widgetForTool(
  tool: DashboardTool,
  columns: number,
  col: number,
  row: number,
): DashboardWidget | null {
  const type = widgetTypeForTool(tool);
  if (!type) {
    return null;
  }
  const { colSpan, rowSpan } = defaultWidgetSize(type, columns);
  const cappedCol = Math.max(0, Math.min(col, Math.max(0, columns - colSpan)));
  const cappedRow = Math.max(0, row);
  const id = crypto.randomUUID();
  const layout = { col: cappedCol, row: cappedRow, colSpan, rowSpan };
  switch (type) {
    case "visualization":
      return { id, type, layout, config: { showTitle: true, showDescription: false } };
    case "richText":
      return { id, type, layout, config: { html: "" } };
    case "table":
      return {
        id,
        type,
        layout,
        config: { pageSize: 25, showTitle: false, showDescription: false },
      };
    case "filter":
      return { id, type, layout, config: { showTitle: true, showDescription: false } };
  }
}

export function compactWithGhost(
  items: LayoutItem[],
  ghost: LayoutItem,
  cols: number,
): LayoutItem[] {
  const cloned = items.map((item) => ({ ...item }));
  return [...verticalCompactor.compact([...cloned, ghost], cols)];
}

export function widgetToLayoutItem(widget: DashboardWidget): LayoutItem {
  const { minW, minH, maxH } = getWidgetMinDimensions(widget.type);
  return {
    i: widget.id,
    x: widget.layout.col,
    y: widget.layout.row,
    w: widget.layout.colSpan,
    h: widget.layout.rowSpan,
    resizeHandles: RESIZE_HANDLES,
    minW,
    minH,
    maxH,
  };
}
