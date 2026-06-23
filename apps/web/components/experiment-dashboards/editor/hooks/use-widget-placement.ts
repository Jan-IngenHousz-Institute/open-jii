"use client";

import { useEffect, useState } from "react";
import type { RefObject } from "react";
import { verticalCompactor } from "react-grid-layout";
import type { LayoutItem } from "react-grid-layout";
import type { UseFormReturn } from "react-hook-form";

import type { ExperimentDashboardWidget } from "@repo/api/domains/experiment/experiment.schema";

import type { DashboardFormValues } from "../../dashboard-form-shell";
import {
  defaultWidgetSize,
  widgetForTool,
  widgetToLayoutItem,
  widgetTypeForTool,
} from "../canvas/dashboard-grid-helpers";
import type { DashboardTool } from "../context/dashboard-editor-context";

interface UseWidgetPlacementParams {
  tool: DashboardTool;
  containerRef: RefObject<HTMLDivElement | null>;
  width: number;
  columns: number;
  gap: number;
  rowHeight: number;
  form: UseFormReturn<DashboardFormValues>;
  onPlaced: (widgetId: string) => void;
}

interface SnapTarget {
  col: number;
  row: number;
}

/**
 * Track pointer-snapping for placement mode and drop a new widget on click.
 * Returns the live snap target (`null` outside placement mode) so the canvas
 * can render a ghost rectangle at the would-be drop position.
 */
export function useWidgetPlacement({
  tool,
  containerRef,
  width,
  columns,
  gap,
  rowHeight,
  form,
  onPlaced,
}: UseWidgetPlacementParams): SnapTarget | null {
  const [snapTarget, setSnapTarget] = useState<SnapTarget | null>(null);

  useEffect(() => {
    if (tool === "cursor") {
      setSnapTarget(null);
      return;
    }
    const node = containerRef.current;
    if (!node) {
      return;
    }
    if (!Number.isFinite(width) || width <= 0) {
      return;
    }
    if (!Number.isFinite(columns) || columns <= 0) {
      return;
    }
    if (!Number.isFinite(rowHeight) || rowHeight <= 0) {
      return;
    }

    const colWidth = (width - gap * (columns - 1)) / columns;
    if (!Number.isFinite(colWidth) || colWidth <= 0) {
      return;
    }
    const colPitch = colWidth + gap;
    const rowPitch = rowHeight + gap;

    const type = widgetTypeForTool(tool);
    if (!type) {
      return;
    }
    const { colSpan } = defaultWidgetSize(type, columns);

    const snapAt = (clientX: number, clientY: number): SnapTarget | null => {
      const rect = node.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        return null;
      }
      const rawCol = Math.floor(x / colPitch);
      const rawRow = Math.floor(y / rowPitch);
      const col = Math.max(0, Math.min(rawCol, Math.max(0, columns - colSpan)));
      const row = Math.max(0, rawRow);
      return { col, row };
    };

    const onMove = (e: PointerEvent) => {
      const next = snapAt(e.clientX, e.clientY);
      if (!next) {
        setSnapTarget(null);
        return;
      }
      setSnapTarget((prev) => (prev?.col === next.col && prev.row === next.row ? prev : next));
    };
    const onLeave = () => setSnapTarget(null);

    const onClick = (e: MouseEvent) => {
      const snap = snapAt(e.clientX, e.clientY);
      if (!snap) {
        return;
      }
      const draft = widgetForTool(tool, columns, snap.col, snap.row);
      if (!draft) {
        return;
      }

      e.stopPropagation();
      e.preventDefault();

      // No `static: true` on the draft so the compactor packs it
      // against existing widgets. Honoring the literal clicked row
      // would leave an unfillable band below the last widget.
      const current = form.getValues("widgets");
      const draftItem: LayoutItem = widgetToLayoutItem(draft);
      const baseItems = current.map(widgetToLayoutItem);
      const compacted = verticalCompactor.compact([draftItem, ...baseItems], columns);

      const compactedById = new Map(compacted.map((c) => [c.i, c]));
      const updatedWidgets: ExperimentDashboardWidget[] = current.map((w) => {
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
      const finalDraft = compactedById.get(draft.id);
      const placed: ExperimentDashboardWidget = finalDraft
        ? {
            ...draft,
            layout: {
              col: finalDraft.x,
              row: finalDraft.y,
              colSpan: finalDraft.w,
              rowSpan: finalDraft.h,
            },
          }
        : draft;

      form.setValue("widgets", [...updatedWidgets, placed], { shouldDirty: true });
      onPlaced(placed.id);
    };

    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerleave", onLeave);
    node.addEventListener("click", onClick, { capture: true });
    return () => {
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerleave", onLeave);
      node.removeEventListener("click", onClick, { capture: true });
      setSnapTarget(null);
    };
  }, [tool, width, columns, gap, rowHeight, containerRef, form, onPlaced]);

  return snapTarget;
}
