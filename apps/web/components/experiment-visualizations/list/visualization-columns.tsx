import {
  authorColumn,
  nameColumn,
  updatedColumn,
} from "@/components/overview-table/name-updated-columns";
import type { OverviewTableColumn } from "@/components/overview-table/overview-table";
import { StatusBadge } from "@/components/shared/status-badge";

import type { ExperimentVisualization } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";

import { getChartTypeDef } from "../charts/chart-registry";
import { VisualizationRowActions } from "./visualization-row-actions";
import { visualizationTypeBadgeTone } from "./visualization-type-badge-tone";

export function getVisualizationColumns(
  t: (key: string) => string,
  experimentId: string,
): OverviewTableColumn<ExperimentVisualization>[] {
  return [
    nameColumn(t("ui.labels.columns.name")),
    {
      header: t("ui.labels.columns.type"),
      className: "w-44",
      cell: (visualization) => (
        <StatusBadge tone={visualizationTypeBadgeTone(visualization.chartType)}>
          {t(getChartTypeDef(visualization.chartType).labelKey)}
        </StatusBadge>
      ),
    },
    authorColumn(t("ui.labels.columns.user")),
    updatedColumn(t("ui.labels.columns.updated")),
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
