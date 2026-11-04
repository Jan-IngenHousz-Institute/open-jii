"use client";

import { RowActionsMenu } from "@/components/overview-table/row-actions-menu";
import { useExperimentVisualizationDelete } from "@/hooks/experiment/useExperimentVisualizationDelete/useExperimentVisualizationDelete";

import type { ExperimentVisualization } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
import { useTranslation } from "@repo/i18n";

export interface VisualizationRowActionsProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  /** The chart's page, which is also where it is edited. */
  href: string;
}

export function VisualizationRowActions({
  visualization,
  experimentId,
  href,
}: VisualizationRowActionsProps) {
  const { t } = useTranslation("experimentVisualizations");
  const { t: tCommon } = useTranslation("common");
  const { mutateAsync: deleteVisualization } = useExperimentVisualizationDelete({ experimentId });

  return (
    <RowActionsMenu
      editHref={href}
      labels={{
        trigger: t("ui.actions.moreActions"),
        edit: t("ui.actions.edit"),
        delete: t("ui.actions.delete"),
        deleteDescription: t("ui.messages.deleteConfirm", { name: visualization.name }),
        cancel: tCommon("common.cancel"),
        deleted: t("ui.messages.deleteSuccess"),
      }}
      onDelete={() => deleteVisualization({ id: experimentId, visualizationId: visualization.id })}
    />
  );
}
