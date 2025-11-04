"use client";

import { useExperimentVisualizations } from "@/hooks/experiment/useExperimentVisualizations/useExperimentVisualizations";
import { useParams } from "next/navigation";
import ExperimentVisualizationsList from "~/components/experiment-visualizations/experiment-visualizations-list";

import { useTranslation } from "@repo/i18n";

export default function ExperimentVisualizationsPage() {
  const { t } = useTranslation("experimentVisualizations");
  const { id } = useParams<{ id: string }>();

  const { data: visualizationsData, isLoading } = useExperimentVisualizations({
    experimentId: id,
    initialChartFamily: undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("ui.title")}</h1>
        {/* No create button for archived experiments */}
      </div>

      <ExperimentVisualizationsList
        visualizations={visualizationsData?.body ?? []}
        experimentId={id}
        isLoading={isLoading}
        isArchived={true}
      />
    </div>
  );
}
