"use client";

import { RowActionsMenu } from "@/components/overview-table/row-actions-menu";
import { useExperimentVisualizationDelete } from "@/hooks/experiment/useExperimentVisualizationDelete/useExperimentVisualizationDelete";
import { useExperimentVisualizationDuplicate } from "@/hooks/experiment/useExperimentVisualizationDuplicate/useExperimentVisualizationDuplicate";
import { useLocale } from "@/hooks/useLocale";
import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";

import type { ExperimentVisualization } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
import { useTranslation } from "@repo/i18n";
import { DropdownMenuItem } from "@repo/ui/components/dropdown-menu";

export interface VisualizationRowActionsProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  canDuplicate: boolean;
  /** The chart's page, which is also where it is edited. */
  href: string;
}

export function VisualizationRowActions({
  visualization,
  experimentId,
  canDuplicate,
  href,
}: VisualizationRowActionsProps) {
  const { t } = useTranslation("experimentVisualizations");
  const { t: tCommon } = useTranslation("common");
  const { mutateAsync: deleteVisualization } = useExperimentVisualizationDelete({ experimentId });

  const locale = useLocale();
  const router = useRouter();
  const { duplicate, disabled } = useExperimentVisualizationDuplicate(
    experimentId,
    visualization.id,
  );
  const handleDuplicate = async () => {
    const created = await duplicate();
    if (created) {
      router.push(
        `/${locale}/platform/experiments/${experimentId}/analysis/visualizations/${created.id}`,
      );
    }
  };

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
    >
      {canDuplicate && (
        <DropdownMenuItem disabled={disabled} onSelect={() => void handleDuplicate()}>
          <Copy className="mr-2 size-4" />
          {t("ui.actions.duplicate")}
        </DropdownMenuItem>
      )}
    </RowActionsMenu>
  );
}
