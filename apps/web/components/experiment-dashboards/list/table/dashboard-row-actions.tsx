"use client";

import { RowActionsMenu } from "@/components/overview-table/row-actions-menu";
import { useExperimentDashboardDelete } from "@/hooks/experiment/useExperimentDashboardDelete/useExperimentDashboardDelete";
import { useState } from "react";

import type { ExperimentDashboard } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";
import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

export interface DashboardRowActionsProps {
  dashboard: ExperimentDashboard;
  experimentId: string;
  basePath: string;
}

export function DashboardRowActions({
  dashboard,
  experimentId,
  basePath,
}: DashboardRowActionsProps) {
  const { t } = useTranslation("experimentDashboards");
  const { t: tCommon } = useTranslation("common");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { mutate: deleteDashboard, isPending: isDeleting } = useExperimentDashboardDelete({
    experimentId,
    onSuccess: () => {
      toast({ title: t("ui.messages.deleteSuccess") });
      setConfirmingDelete(false);
    },
  });

  return (
    <RowActionsMenu
      editHref={`/platform/${basePath}/${experimentId}/dashboards/${dashboard.id}?edit=1`}
      labels={{
        trigger: t("ui.actions.moreActions"),
        edit: t("ui.actions.edit"),
        delete: t("ui.actions.delete"),
        deleteDescription: t("ui.messages.deleteConfirm", { name: dashboard.name }),
        cancel: tCommon("common.cancel"),
      }}
      confirmingDelete={confirmingDelete}
      onConfirmingDeleteChange={setConfirmingDelete}
      isDeleting={isDeleting}
      onDelete={() => deleteDashboard({ id: experimentId, dashboardId: dashboard.id })}
    />
  );
}
