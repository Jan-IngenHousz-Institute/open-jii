"use client";

import type { ExperimentDashboardWidget } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";

import { LazyWidget } from "./widgets/shell/lazy-widget";
import { WidgetCard } from "./widgets/shell/widget-card";
import { WidgetRenderer } from "./widgets/widget-renderer";

interface DashboardGridCellProps {
  widget: ExperimentDashboardWidget;
  experimentId: string;
  rowHeight: number;
  gap: number;
  scale: number;
}

export function DashboardGridCell({
  widget,
  experimentId,
  rowHeight,
  gap,
  scale,
}: DashboardGridCellProps) {
  const { col, row, colSpan, rowSpan } = widget.layout;
  const height = (rowHeight * rowSpan + gap * (rowSpan - 1)) * scale;

  return (
    <div
      style={{
        gridColumn: `${col + 1} / span ${colSpan}`,
        gridRow: `${row + 1} / span ${rowSpan}`,
      }}
    >
      <WidgetCard>
        <LazyWidget intrinsicHeight={height}>
          <WidgetRenderer widget={widget} experimentId={experimentId} />
        </LazyWidget>
      </WidgetCard>
    </div>
  );
}
