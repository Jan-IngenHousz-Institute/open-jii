"use client";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { LayoutGrid } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { GridLayout, useContainerWidth } from "react-grid-layout";
import type { Layout, LayoutItem } from "react-grid-layout";
import type { Control } from "react-hook-form";
import { useFormContext, useWatch } from "react-hook-form";

import { useTranslation } from "@repo/i18n";

import { WidgetCard } from "../widgets/widget-card";
import { getWidgetMinDimensions } from "../widgets/widget-dimensions";
import { WidgetEditor } from "../widgets/widget-renderer";
import type { DashboardFormValues } from "./dashboard-form-values";

interface DashboardCanvasProps {
  control: Control<DashboardFormValues>;
  experimentId: string;
}

/**
 * Editor canvas. Uses `react-grid-layout` v2 for drag + resize. Each widget
 * card carries a hover-revealed handle (the `dashboard-widget-drag-handle`
 * class on `WidgetCard`) so chart bodies stay interactive — drag only
 * happens from the handle. The read-only renderer (`dashboard-renderer.tsx`)
 * keeps a pure CSS grid; no need for the interactive lib outside the editor.
 *
 * All per-widget configuration lives inside the widget itself via
 * `<WidgetEditor>` (Notion/Tableau pattern) — there's no side panel.
 */
export function DashboardCanvas({ control, experimentId }: DashboardCanvasProps) {
  const { t } = useTranslation("experimentDashboards");
  const form = useFormContext<DashboardFormValues>();
  const layout = useWatch({ control, name: "layout" });
  // Watch the array here ONLY for the bookkeeping the canvas itself needs:
  // length (for empty state), id list (RGL's `layout`), and per-widget
  // positions (for RGL's `layout`). Each widget body subscribes to its own
  // slice via `WidgetSlot` below, so typing in one widget doesn't trigger
  // re-renders of the others (Plotly charts especially).
  const widgets = useWatch({ control, name: "widgets" });

  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);

  // Document-level deselect: any pointerdown that doesn't land inside a
  // widget (markered by `data-dashboard-widget`) clears the selection.
  // Covers clicks on the page header, the title input, the breadcrumb, and
  // every other surface outside the canvas — not just the canvas's own
  // gap. Esc gives keyboard users an out without leaving the focus chain.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (selectedWidgetId === null) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Radix portals (e.g., the kebab dropdown menu) render outside the
      // widget tree. Treat clicks on those as "still inside the widget"
      // so opening the menu doesn't deselect mid-action.
      if (target.closest("[data-dashboard-widget]")) return;
      if (target.closest("[data-radix-popper-content-wrapper]")) return;
      setSelectedWidgetId(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedWidgetId !== null) {
        setSelectedWidgetId(null);
        // If focus is currently inside a widget (e.g., Quill editor), drop
        // it so the next Tab starts from a sensible place.
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedWidgetId]);

  const { width, containerRef, mounted } = useContainerWidth();

  const rglLayout = useMemo<LayoutItem[]>(
    () =>
      widgets.map((widget) => ({
        i: widget.id,
        x: widget.layout.col,
        y: widget.layout.row,
        w: widget.layout.colSpan,
        h: widget.layout.rowSpan,
        ...getWidgetMinDimensions(widget.type),
      })),
    [widgets],
  );

  // Render children in visual reading order (top-to-bottom, then
  // left-to-right) so Tab walks the grid the way a user reads it. RGL
  // positions items by their `layout` entry, not by child order, so
  // reordering here is purely a DOM/tab-order concern.
  const renderOrder = useMemo(
    () =>
      widgets
        .map((widget, index) => ({ widget, index }))
        .sort((a, b) => {
          const rowDiff = a.widget.layout.row - b.widget.layout.row;
          if (rowDiff !== 0) return rowDiff;
          return a.widget.layout.col - b.widget.layout.col;
        }),
    [widgets],
  );

  // Stable callback identities so the memoized `WidgetSlot` doesn't bust on
  // every canvas render. The closure reads the live `widgets` array via
  // `form.getValues` to avoid pulling it into the dep list.
  const handleLayoutChange = useCallback(
    (next: Layout) => {
      const current = form.getValues("widgets");
      let changed = false;
      const updated = current.map((widget) => {
        const item = next.find((entry) => entry.i === widget.id);
        if (!item) return widget;
        const sameLayout =
          item.x === widget.layout.col &&
          item.y === widget.layout.row &&
          item.w === widget.layout.colSpan &&
          item.h === widget.layout.rowSpan;
        if (sameLayout) return widget;
        changed = true;
        return {
          ...widget,
          layout: { col: item.x, row: item.y, colSpan: item.w, rowSpan: item.h },
        };
      });
      if (changed) {
        form.setValue("widgets", updated, { shouldDirty: true });
      }
    },
    [form],
  );

  const handleRemoveWidget = useCallback(
    (widgetId: string) => {
      const current = form.getValues("widgets");
      form.setValue(
        "widgets",
        current.filter((w) => w.id !== widgetId),
        { shouldDirty: true },
      );
    },
    [form],
  );

  const handleSelectWidget = useCallback((widgetId: string) => {
    setSelectedWidgetId(widgetId);
  }, []);

  if (widgets.length === 0) {
    return (
      <div className="bg-muted/20 text-muted-foreground flex h-96 flex-col items-center justify-center gap-2 rounded-xl border border-dashed">
        <LayoutGrid className="h-8 w-8 opacity-60" />
        <span className="text-sm font-medium">{t("ui.messages.noDashboards")}</span>
        <span className="text-xs">{t("editor.addWidget")}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="dashboard-canvas-root w-full">
      {mounted && (
        <GridLayout
          width={width}
          layout={rglLayout}
          gridConfig={{
            cols: layout.columns,
            rowHeight: layout.rowHeight,
            margin: [layout.gap, layout.gap],
          }}
          dragConfig={{
            handle: ".dashboard-widget-drag-handle",
          }}
          onLayoutChange={handleLayoutChange}
        >
          {renderOrder.map(({ widget, index }) => (
            <div key={widget.id}>
              <WidgetSlot
                widgetId={widget.id}
                widgetIndex={index}
                experimentId={experimentId}
                isSelected={selectedWidgetId === widget.id}
                onSelect={handleSelectWidget}
                onRemove={handleRemoveWidget}
              />
            </div>
          ))}
        </GridLayout>
      )}
    </div>
  );
}

interface WidgetSlotProps {
  widgetId: string;
  widgetIndex: number;
  experimentId: string;
  isSelected: boolean;
  onSelect: (widgetId: string) => void;
  onRemove: (widgetId: string) => void;
}

/**
 * Per-widget render slot. Subscribes to its own RHF slice so editing one
 * widget (e.g. typing in a rich-text body) doesn't fan out into a canvas-
 * wide re-render — only this slot updates. Memoized on stable inputs so
 * the canvas's own re-renders (which DO fire when the array shape changes)
 * skip slots whose props haven't moved.
 */
const WidgetSlot = memo(function WidgetSlot({
  widgetId,
  widgetIndex,
  experimentId,
  isSelected,
  onSelect,
  onRemove,
}: WidgetSlotProps) {
  const { control } = useFormContext<DashboardFormValues>();
  const widget = useWatch({ control, name: `widgets.${widgetIndex}` });
  if (!widget || widget.id !== widgetId) return null;

  return (
    <WidgetCard isSelected={isSelected} onSelect={() => onSelect(widgetId)}>
      <WidgetEditor
        widget={widget}
        experimentId={experimentId}
        widgetIndex={widgetIndex}
        isSelected={isSelected}
        onRemove={() => onRemove(widgetId)}
      />
    </WidgetCard>
  );
});
