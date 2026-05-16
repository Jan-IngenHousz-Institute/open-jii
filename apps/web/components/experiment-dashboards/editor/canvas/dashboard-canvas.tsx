"use client";

import { useCallback, useEffect, useMemo } from "react";
import { GridLayout, useContainerWidth } from "react-grid-layout";
import type { Layout, LayoutItem } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { useFormContext, useWatch } from "react-hook-form";
import "react-resizable/css/styles.css";

import { cn } from "@repo/ui/lib/utils";

import { DashboardFiltersProvider } from "../../dashboard-filters-context";
import type { DashboardFormValues } from "../../dashboard-form-shell";
import { useDashboardEditor } from "../context/dashboard-editor-context";
import { useDeselectOnOutsideClick } from "../hooks/use-deselect-on-outside-click";
import { usePlotlyResizeOnLayout } from "../hooks/use-plotly-resize-on-layout";
import { useWidgetPlacement } from "../hooks/use-widget-placement";
import { DashboardCanvasEmptyState, PlacementGhost } from "./dashboard-canvas-overlays";
import "./dashboard-canvas.css";
import {
  compactWithGhost,
  defaultWidgetSize,
  DRAG_CANCEL_SELECTOR,
  PLACEMENT_GHOST_ID,
  RESIZE_HANDLES,
  widgetToLayoutItem,
  widgetTypeForTool,
} from "./dashboard-grid-helpers";
import { WidgetSlot } from "./widget-slot";

interface DashboardCanvasProps {
  experimentId: string;
}

export function DashboardCanvas({ experimentId }: DashboardCanvasProps) {
  const form = useFormContext<DashboardFormValues>();
  const { control } = form;
  const layout = useWatch({ control, name: "layout" });
  // Canvas-level only; each WidgetSlot subscribes to its own slice.
  const widgets = useWatch({ control, name: "widgets" });

  const { selectedWidgetId, selectWidget, tool, setTool } = useDashboardEditor();

  useDeselectOnOutsideClick({ tool, selectedWidgetId, selectWidget, setTool });

  const { width, containerRef, mounted } = useContainerWidth();

  useEffect(() => {
    if (!selectedWidgetId) {
      return;
    }
    const el = document.querySelector(`[data-dashboard-widget-id="${selectedWidgetId}"]`);
    if (!el) {
      return;
    }
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedWidgetId]);

  const baseLayout = useMemo<LayoutItem[]>(() => widgets.map(widgetToLayoutItem), [widgets]);

  const onWidgetPlaced = useCallback(
    (widgetId: string) => {
      selectWidget(widgetId);
      setTool("cursor");
    },
    [selectWidget, setTool],
  );

  const snapTarget = useWidgetPlacement({
    tool,
    containerRef,
    width,
    columns: layout.columns,
    gap: layout.gap,
    rowHeight: layout.rowHeight,
    form,
    onPlaced: onWidgetPlaced,
  });

  const rglLayout = useMemo<LayoutItem[]>(() => {
    if (tool === "cursor" || !snapTarget) {
      return baseLayout;
    }
    const type = widgetTypeForTool(tool);
    if (!type) {
      return baseLayout;
    }
    const { colSpan, rowSpan } = defaultWidgetSize(type, layout.columns);
    return compactWithGhost(
      baseLayout,
      {
        i: PLACEMENT_GHOST_ID,
        x: snapTarget.col,
        y: snapTarget.row,
        w: colSpan,
        h: rowSpan,
        static: true,
      },
      layout.columns,
    );
  }, [baseLayout, layout.columns, tool, snapTarget]);

  usePlotlyResizeOnLayout(width);

  // DOM order = visual reading order so Tab walks the grid naturally.
  const renderOrder = useMemo(
    () =>
      widgets
        .map((widget, index) => ({ widget, index }))
        .sort((a, b) => {
          const rowDiff = a.widget.layout.row - b.widget.layout.row;
          if (rowDiff !== 0) {
            return rowDiff;
          }
          return a.widget.layout.col - b.widget.layout.col;
        }),
    [widgets],
  );

  const persistLayout = useCallback(
    (next: Layout) => {
      const nextById = new Map(next.map((entry) => [entry.i, entry]));
      const current = form.getValues("widgets");
      const updated = current.map((widget) => {
        const item = nextById.get(widget.id);
        if (!item) {
          return widget;
        }
        const sameLayout =
          item.x === widget.layout.col &&
          item.y === widget.layout.row &&
          item.w === widget.layout.colSpan &&
          item.h === widget.layout.rowSpan;
        if (sameLayout) {
          return widget;
        }
        return {
          ...widget,
          layout: { col: item.x, row: item.y, colSpan: item.w, rowSpan: item.h },
        };
      });
      if (updated.some((u, i) => u !== current[i])) {
        form.setValue("widgets", updated, { shouldDirty: true });
      }
    },
    [form],
  );

  const gridConfig = useMemo(
    () => ({
      cols: layout.columns,
      rowHeight: layout.rowHeight,
      margin: [layout.gap, layout.gap] as [number, number],
      containerPadding: [0, 0] as [number, number],
    }),
    [layout.columns, layout.rowHeight, layout.gap],
  );
  const dragConfig = useMemo(() => ({ cancel: DRAG_CANCEL_SELECTOR }), []);
  const resizeConfig = useMemo(() => ({ handles: RESIZE_HANDLES }), []);

  const placementActive = tool !== "cursor";

  const handleDragStop = useCallback(
    (next: Layout) => {
      persistLayout(next);
    },
    [persistLayout],
  );
  const handleResizeStop = useCallback(
    (next: Layout) => {
      persistLayout(next);
      requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    },
    [persistLayout],
  );

  return (
    <DashboardFiltersProvider widgets={widgets}>
      {/* Keep containerRef mounted so RGL's ResizeObserver attaches on first paint. */}
      <div
        ref={containerRef}
        className={cn(
          "dashboard-canvas-root relative w-full",
          placementActive && "cursor-crosshair",
          // Stretch past last widget in placement mode so empty space is clickable.
          placementActive && "min-h-[60vh]",
        )}
      >
        {widgets.length === 0 && !placementActive && <DashboardCanvasEmptyState />}
        {mounted && (
          <GridLayout
            width={width}
            layout={rglLayout}
            gridConfig={gridConfig}
            dragConfig={dragConfig}
            resizeConfig={resizeConfig}
            onDragStop={handleDragStop}
            onResizeStop={handleResizeStop}
          >
            {renderOrder.map(({ widget, index }) => (
              <div key={widget.id} data-dashboard-widget-id={widget.id}>
                <WidgetSlot
                  widgetId={widget.id}
                  widgetIndex={index}
                  experimentId={experimentId}
                  isSelected={selectedWidgetId === widget.id}
                  onSelect={selectWidget}
                />
              </div>
            ))}
            {placementActive && snapTarget && (
              <div key={PLACEMENT_GHOST_ID} data-placement-ghost="">
                <PlacementGhost />
              </div>
            )}
          </GridLayout>
        )}
      </div>
    </DashboardFiltersProvider>
  );
}
