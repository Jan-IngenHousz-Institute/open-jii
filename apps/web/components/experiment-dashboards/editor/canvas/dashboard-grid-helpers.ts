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

/**
 * Run `verticalCompactor` over the widgets and return a new widget array with
 * any shifted layouts updated in place. Widgets whose layouts didn't move stay
 * referentially equal so unrelated state (config edits, refs) isn't disturbed.
 *
 * Use this after any change that can leave a gap (delete, resize-shrink) so the
 * form's layout stays in sync with what RGL renders.
 */
export function compactWidgets(widgets: DashboardWidget[], columns: number): DashboardWidget[] {
  const compacted = verticalCompactor.compact(widgets.map(widgetToLayoutItem), columns);
  const compactedById = new Map(compacted.map((item) => [item.i, item]));
  return widgets.map((w) => {
    const c = compactedById.get(w.id);
    if (!c) {
      return w;
    }
    const sameLayout =
      c.x === w.layout.col &&
      c.y === w.layout.row &&
      c.w === w.layout.colSpan &&
      c.h === w.layout.rowSpan;
    if (sameLayout) {
      return w;
    }
    return {
      ...w,
      layout: { col: c.x, row: c.y, colSpan: c.w, rowSpan: c.h },
    };
  });
}
