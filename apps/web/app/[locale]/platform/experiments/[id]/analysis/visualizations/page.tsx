"use client";

import { lineChartType } from "@/components/experiment-visualizations/charts/basic/line";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { useExperimentVisualizationCreate } from "@/hooks/experiment/useExperimentVisualizationCreate/useExperimentVisualizationCreate";
import { useExperimentVisualizations } from "@/hooks/experiment/useExperimentVisualizations/useExperimentVisualizations";
import { useLocale } from "@/hooks/useLocale";
import { Loader2, PlusCircle } from "lucide-react";
import { notFound, useParams, useRouter } from "next/navigation";
import ExperimentVisualizationsList from "~/components/experiment-visualizations/list/experiment-visualizations-list";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

export default function ExperimentVisualizationsPage() {
  const { t } = useTranslation("experimentVisualizations");
  const { id: experimentId } = useParams<{ id: string }>();
  const router = useRouter();
  const locale = useLocale();

  const { data: accessData } = useExperimentAccess(experimentId);
  const experimentData = accessData?.experiment;
  const hasAccess = accessData?.isAdmin;

  if (experimentData?.status === "archived") {
    notFound();
  }

  const { data: visualizationsData, isLoading } = useExperimentVisualizations({
    experimentId,
    initialChartFamily: undefined,
  });

  const { mutate: createVisualization, isPending: isCreating } = useExperimentVisualizationCreate({
    experimentId,
    onSuccess: (created) => {
      router.push(
        `/${locale}/platform/experiments/${experimentId}/analysis/visualizations/${created.id}`,
      );
    },
  });

  const handleCreate = () => {
    const defaultName = `${t("workspace.layout.untitled")} - ${new Date().toLocaleDateString(
      locale,
      {
        month: "short",
        day: "numeric",
        year: "numeric",
      },
    )}`;
    createVisualization({
      params: { id: experimentId },
      body: {
        name: defaultName,
        chartFamily: lineChartType.family,
        chartType: lineChartType.type,
        config: { ...lineChartType.defaultConfig() },
        dataConfig: lineChartType.defaultDataConfig(),
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-4">
        <Button onClick={handleCreate} disabled={!hasAccess || isCreating}>
          {isCreating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <PlusCircle className="mr-2 h-4 w-4" />
          )}
          {t("ui.actions.create")}
        </Button>
      </div>

      <ExperimentVisualizationsList
        visualizations={visualizationsData?.body ?? []}
        experimentId={experimentId}
        isLoading={isLoading}
      />
    </div>
  );
}
