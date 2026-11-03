"use client";

import { NameUpdatedList } from "@/components/overview-table/name-updated-list";

import type { ExperimentVisualization } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
import { useTranslation } from "@repo/i18n";

import { getVisualizationColumns } from "./visualization-columns";

interface ExperimentVisualizationsListProps {
  visualizations: ExperimentVisualization[];
  experimentId: string;
  isLoading?: boolean;
  isArchived?: boolean;
}

export default function ExperimentVisualizationsList({
  visualizations,
  experimentId,
  isLoading,
  isArchived = false,
}: ExperimentVisualizationsListProps) {
  const { t } = useTranslation("experimentVisualizations");
  const basePath = isArchived ? "experiments-archive" : "experiments";

  return (
    <NameUpdatedList
      items={visualizations}
      columns={getVisualizationColumns(t, experimentId)}
      getRowHref={(visualization) =>
        `/platform/${basePath}/${experimentId}/analysis/visualizations/${visualization.id}`
      }
      isLoading={isLoading}
      emptyMessage={t("ui.messages.noVisualizations")}
      emptyHelpPath={isArchived ? undefined : "/guide/data-analysis/viewing-data"}
    />
  );
}
