"use client";

import { LayoutGrid } from "lucide-react";

import type { ExperimentDashboard } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";

import { WidgetCard } from "./widgets/widget-card";
import { WidgetRenderer } from "./widgets/widget-renderer";

interface DashboardRendererProps {
  dashboard: ExperimentDashboard;
  experimentId: string;
  /**
   * Optional scale factor for the renderer's grid. Used by the experiment
   * overview slider where dashboards are shown shrunken. Defaults to 1.
   */
  scale?: number;
}

/**
 * Read-only dashboard renderer. Uses CSS grid keyed off the dashboard's
 * `layout` settings; each widget positions itself via grid-column /
 * grid-row from its `layout` slot. Empty dashboards show a small placeholder
 * so the surrounding container isn't blank.
 */
export function DashboardRenderer({ dashboard, experimentId, scale = 1 }: DashboardRendererProps) {
  const { t } = useTranslation("experimentDashboards");
  const { columns, rowHeight, gap } = dashboard.layout;

  if (dashboard.widgets.length === 0) {
    return (
      <div className="bg-muted/20 text-muted-foreground flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed">
        <LayoutGrid className="h-8 w-8 opacity-60" />
        <span className="text-sm font-medium">{t("ui.messages.noDashboards")}</span>
      </div>
    );
  }

  return (
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
            <WidgetRenderer widget={widget} experimentId={experimentId} />
          </WidgetCard>
        </div>
      ))}
    </div>
  );
}
