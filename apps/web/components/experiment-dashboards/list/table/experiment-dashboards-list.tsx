"use client";

import { NameUpdatedList } from "@/components/overview-table/name-updated-list";

import type { ExperimentDashboard } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";
import { useTranslation } from "@repo/i18n";

import { getDashboardColumns } from "./dashboard-columns";

interface ExperimentDashboardsListProps {
  dashboards: ExperimentDashboard[];
  experimentId: string;
  isLoading?: boolean;
  isArchived?: boolean;
}

export default function ExperimentDashboardsList({
  dashboards,
  experimentId,
  isLoading,
  isArchived = false,
}: ExperimentDashboardsListProps) {
  const { t } = useTranslation("experimentDashboards");
  const basePath = isArchived ? "experiments-archive" : "experiments";

  return (
    <NameUpdatedList
      items={dashboards}
      columns={getDashboardColumns(t, experimentId, basePath)}
      getRowHref={(dashboard) => `/platform/${basePath}/${experimentId}/dashboards/${dashboard.id}`}
      countLabel={(count) => t("ui.labels.listCount", { count })}
      isLoading={isLoading}
      emptyMessage={t("ui.messages.emptyDashboard")}
    />
  );
}
