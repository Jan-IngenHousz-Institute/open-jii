import { ListAuthorCell } from "@/components/experiment-dashboards/list/table/list-author-cell";
import { IntentLink } from "@/components/navigation/intent-link/intent-link";
import type { OverviewTableColumn } from "@/components/overview-table/overview-table";
import { overviewTableText } from "@/components/overview-table/overview-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate } from "@/util/date";

import type { ExperimentVisualization } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
import { cn } from "@repo/ui/lib/utils";

import { getChartTypeDef } from "../charts/chart-registry";
import { VisualizationRowActions } from "./visualization-row-actions";
import { visualizationTypeBadgeTone } from "./visualization-type-badge-tone";

interface VisualizationColumnsOptions {
  t: (key: string) => string;
  tCommon: (key: string) => string;
  experimentId: string;
}

/** The charts list's columns; name and update sort, in the browser. */
export function getVisualizationColumns({
  t,
  tCommon,
  experimentId,
}: VisualizationColumnsOptions): OverviewTableColumn<ExperimentVisualization>[] {
  return [
    {
      header: t("ui.labels.columns.name"),
      sortId: "name",
      cell: (visualization, href) => (
        <IntentLink
          href={href}
          title={visualization.name}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "focus-visible:ring-primary/40 focus-visible:outline-hidden block min-w-0 truncate text-[13px] font-semibold hover:underline focus-visible:ring-2",
            overviewTableText.strong,
          )}
        >
          {visualization.name}
        </IntentLink>
      ),
    },
    {
      header: t("ui.labels.columns.type"),
      className: "w-44",
      cell: (visualization) => (
        <StatusBadge tone={visualizationTypeBadgeTone(visualization.chartType)}>
          {t(getChartTypeDef(visualization.chartType).labelKey)}
        </StatusBadge>
      ),
    },
    {
      header: t("ui.labels.columns.user"),
      className: "w-56",
      cell: (visualization) => (
        <ListAuthorCell displayName={visualization.createdByName} tCommon={tCommon} />
      ),
    },
    {
      header: t("ui.labels.columns.updated"),
      sortId: "updatedAt",
      className: "w-40",
      cell: (visualization) => (
        <span className={cn("text-[13px] tabular-nums", overviewTableText.muted)}>
          {formatDate(visualization.updatedAt)}
        </span>
      ),
    },
    {
      header: null,
      className: "w-14 px-3",
      cell: (visualization, href) => (
        <VisualizationRowActions
          visualization={visualization}
          experimentId={experimentId}
          href={href}
        />
      ),
    },
  ];
}
