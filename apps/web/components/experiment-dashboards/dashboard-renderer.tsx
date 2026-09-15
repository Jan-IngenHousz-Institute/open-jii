"use client";

import { LayoutGrid } from "lucide-react";

import type { ExperimentDashboard } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";
import { useTranslation } from "@repo/i18n";

import { DashboardFiltersProvider } from "./dashboard-filters-context";
import { DashboardSharedReadsProvider } from "./dashboard-shared-reads-context";
import { LazyWidget } from "./widgets/shell/lazy-widget";
import { WidgetCard } from "./widgets/shell/widget-card";
import { WidgetRenderer } from "./widgets/widget-renderer";

interface DashboardRendererProps {
  dashboard: ExperimentDashboard;
  experimentId: string;
  scale?: number;
}

export function DashboardRenderer({ dashboard, experimentId, scale = 1 }: DashboardRendererProps) {
  const { t } = useTranslation("experimentDashboards");
  const { columns, rowHeight, gap } = dashboard.layout;

  if (dashboard.widgets.length === 0) {
    return (
      <div className="text-muted-foreground flex h-64 flex-col items-center justify-center gap-2">
        <LayoutGrid className="h-8 w-8 opacity-60" />
        <span className="text-sm font-medium">{t("ui.messages.emptyDashboard")}</span>
      </div>
    );
  }

  return (
    <DashboardFiltersProvider widgets={dashboard.widgets}>
      <DashboardSharedReadsProvider experimentId={experimentId} widgets={dashboard.widgets}>
        <div
          className="w-full"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gridAutoRows: `${rowHeight * scale}px`,
            gap: `${gap * scale}px`,
          }}
        >
          {dashboard.widgets.map((widget) => (
            <div
              key={widget.id}
              style={{
                gridColumn: `${widget.layout.col + 1} / span ${widget.layout.colSpan}`,
                gridRow: `${widget.layout.row + 1} / span ${widget.layout.rowSpan}`,
              }}
            >
              <WidgetCard>
                <LazyWidget
                  intrinsicHeight={
                    (rowHeight * widget.layout.rowSpan + gap * (widget.layout.rowSpan - 1)) * scale
                  }
                >
                  <WidgetRenderer widget={widget} experimentId={experimentId} />
                </LazyWidget>
              </WidgetCard>
            </div>
          ))}
        </div>
      </DashboardSharedReadsProvider>
    </DashboardFiltersProvider>
  );
}
