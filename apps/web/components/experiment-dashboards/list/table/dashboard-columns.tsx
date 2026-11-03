import {
  authorColumn,
  nameColumn,
  updatedColumn,
} from "@/components/overview-table/name-updated-columns";
import type { OverviewTableColumn } from "@/components/overview-table/overview-table";
import { overviewTableText } from "@/components/overview-table/overview-table";

import type { ExperimentDashboard } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";
import { cn } from "@repo/ui/lib/utils";

import { DashboardRowActions } from "./dashboard-row-actions";

export function getDashboardColumns(
  t: (key: string) => string,
  experimentId: string,
  basePath: string,
): OverviewTableColumn<ExperimentDashboard>[] {
  return [
    nameColumn(t("ui.labels.columns.name")),
    {
      header: t("ui.labels.columns.widgets"),
      className: "w-28",
      cell: (dashboard) => (
        <span className={cn("text-[13px]", overviewTableText.muted)}>
          {dashboard.widgets.length}
        </span>
      ),
    },
    authorColumn(t("ui.labels.columns.user")),
    updatedColumn(t("ui.labels.columns.updated")),
    {
      header: null,
      className: "w-14 px-3",
      cell: (dashboard) => (
        <DashboardRowActions
          dashboard={dashboard}
          experimentId={experimentId}
          basePath={basePath}
        />
      ),
    },
  ];
}
