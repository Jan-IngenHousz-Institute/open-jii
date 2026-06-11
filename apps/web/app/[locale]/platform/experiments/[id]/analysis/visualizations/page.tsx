"use client";

import { lineChartType } from "@/components/experiment-visualizations/charts/basic/line";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { useExperimentVisualizationCreate } from "@/hooks/experiment/useExperimentVisualizationCreate/useExperimentVisualizationCreate";
import { useExperimentVisualizations } from "@/hooks/experiment/useExperimentVisualizations/useExperimentVisualizations";
import { useLocale } from "@/shared/i18n/useLocale";
import { Loader2, PlusCircle } from "lucide-react";
import { notFound, useParams, useRouter } from "next/navigation";
import ExperimentVisualizationsList from "~/components/experiment-visualizations/list/experiment-visualizations-list";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";

export default function ExperimentVisualizationsPage() {
  const { t } = useTranslation("experimentVisualizations");
  const { t: tExperiments } = useTranslation("experiments");
  const { id: experimentId } = useParams<{ id: string }>();
  const router = useRouter();
  const locale = useLocale();

  const { data: accessData } = useExperimentAccess(experimentId);
  const experimentData = accessData?.body.experiment;
  const hasAccess = accessData?.body.isAdmin;

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
      <div className="flex items-center justify-between gap-4">
        {/* Segmented control. Visualizations is the only real surface today;
            Notebooks is a disabled segment so users can see what's coming
            without us baking in a navigation contract for a route that
            doesn't exist yet. Promote both segments to Links once Notebooks
            ships. */}
        <div
          role="tablist"
          aria-label={tExperiments("analysis.title")}
          className="bg-muted text-muted-foreground inline-flex h-9 items-center justify-center rounded-lg p-1"
        >
          <span
            role="tab"
            aria-selected="true"
            className={cn(
              "bg-background text-foreground inline-flex items-center justify-center rounded-md px-3 py-1 text-sm font-medium shadow",
            )}
          >
            {tExperiments("analysis.visualizations")}
          </span>
          <button
            type="button"
            role="tab"
            aria-selected="false"
            disabled
            className="inline-flex cursor-not-allowed items-center justify-center rounded-md px-3 py-1 text-sm font-medium opacity-50"
          >
            {tExperiments("analysis.notebooks")}
          </button>
        </div>

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
