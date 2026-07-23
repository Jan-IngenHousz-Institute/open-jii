"use client";

import type { ExperimentDashboard } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";
import { Skeleton } from "@repo/ui/components/skeleton";

export interface DashboardLayoutSkeletonProps {
  dashboard: ExperimentDashboard;
  innerHeight: number;
  scale: number;
  width: number;
}

export function DashboardLayoutSkeleton({
  dashboard,
  innerHeight,
  scale,
  width,
}: DashboardLayoutSkeletonProps) {
  const { columns, rowHeight, gap } = dashboard.layout;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 grid origin-top-left"
      style={{
        width,
        height: innerHeight,
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gridAutoRows: `${rowHeight}px`,
        gap: `${gap}px`,
        transform: `scale(${scale || 1})`,
      }}
    >
      {dashboard.widgets.map((w) => (
        <Skeleton
          key={w.id}
          className="rounded-xl"
          style={{
            gridColumn: `${w.layout.col + 1} / span ${w.layout.colSpan}`,
            gridRow: `${w.layout.row + 1} / span ${w.layout.rowSpan}`,
          }}
        />
      ))}
    </div>
  );
}
