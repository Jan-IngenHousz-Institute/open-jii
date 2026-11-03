import { IntentLink } from "@/components/navigation/intent-link/intent-link";
import type { OverviewTableColumn } from "@/components/overview-table/overview-table";
import { overviewTableText } from "@/components/overview-table/overview-table";
import { formatDate } from "@/util/date";

import type { ExperimentDashboard } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";
import { cn } from "@repo/ui/lib/utils";

import { DashboardRowActions } from "./dashboard-row-actions";
import { ListAuthorCell } from "./list-author-cell";

interface DashboardColumnsOptions {
  t: (key: string) => string;
  tCommon: (key: string) => string;
  experimentId: string;
  basePath: string;
}

/** The dashboards list's columns; name and update sort, in the browser. */
export function getDashboardColumns({
  t,
  tCommon,
  experimentId,
  basePath,
}: DashboardColumnsOptions): OverviewTableColumn<ExperimentDashboard>[] {
  return [
    {
      header: t("ui.labels.columns.name"),
      sortId: "name",
      cell: (dashboard, href) => (
        <IntentLink
          href={href}
          title={dashboard.name}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "focus-visible:ring-primary/40 focus-visible:outline-hidden block min-w-0 truncate text-[13px] font-semibold hover:underline focus-visible:ring-2",
            overviewTableText.strong,
          )}
        >
          {dashboard.name}
        </IntentLink>
      ),
    },
    {
      header: t("ui.labels.columns.widgets"),
      className: "w-28",
      cell: (dashboard) => (
        <span className={cn("text-[13px]", overviewTableText.muted)}>
          {dashboard.widgets.length}
        </span>
      ),
    },
    {
      header: t("ui.labels.columns.user"),
      className: "w-56",
      cell: (dashboard) => (
        <ListAuthorCell displayName={dashboard.createdByName} tCommon={tCommon} />
      ),
    },
    {
      header: t("ui.labels.columns.updated"),
      sortId: "updatedAt",
      className: "w-40",
      cell: (dashboard) => (
        <span className={cn("text-[13px] tabular-nums", overviewTableText.muted)}>
          {formatDate(dashboard.updatedAt)}
        </span>
      ),
    },
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
