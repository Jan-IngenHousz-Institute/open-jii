"use client";

import { RowActionsMenu } from "@/components/overview-table/row-actions-menu";
import { useExperimentDashboardDelete } from "@/hooks/experiment/useExperimentDashboardDelete/useExperimentDashboardDelete";

import type { ExperimentDashboard } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";
import { useTranslation } from "@repo/i18n";

export interface DashboardRowActionsProps {
  dashboard: ExperimentDashboard;
  experimentId: string;
  href: string;
}

export function DashboardRowActions({ dashboard, experimentId, href }: DashboardRowActionsProps) {
  const { t } = useTranslation("experimentDashboards");
  const { t: tCommon } = useTranslation("common");
  const { mutateAsync: deleteDashboard } = useExperimentDashboardDelete({ experimentId });

  return (
    <RowActionsMenu
      editHref={`${href}?edit=1`}
      labels={{
        trigger: t("ui.actions.moreActions"),
        edit: t("ui.actions.edit"),
        delete: t("ui.actions.delete"),
        deleteDescription: t("ui.messages.deleteConfirm", { name: dashboard.name }),
        cancel: tCommon("common.cancel"),
        deleted: t("ui.messages.deleteSuccess"),
      }}
      onDelete={() => deleteDashboard({ id: experimentId, dashboardId: dashboard.id })}
    />
  );
}
