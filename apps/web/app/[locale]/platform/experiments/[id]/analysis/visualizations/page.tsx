"use client";

import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { useExperimentVisualizations } from "@/hooks/experiment/useExperimentVisualizations/useExperimentVisualizations";
import { useLocale } from "@/hooks/useLocale";
import { PlusCircle } from "lucide-react";
import { notFound, useParams, useRouter } from "next/navigation";
import ExperimentVisualizationsList from "~/components/experiment-visualizations/experiment-visualizations-list";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components";

export default function ExperimentVisualizationsPage() {
  const { t } = useTranslation("experimentVisualizations");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const locale = useLocale();

  // Check if experiment is archived - if so, redirect to not found (should use archive route)
  const { data: accessData } = useExperimentAccess(id);
  const experimentData = accessData?.body.experiment;
  const hasAccess = accessData?.body.isAdmin;

  if (experimentData?.status === "archived") {
    notFound();
  }

  const { data: visualizationsData, isLoading } = useExperimentVisualizations({
    experimentId: id,
    initialChartFamily: undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("ui.title")}</h1>
        <Button
          onClick={() =>
            router.push(`/${locale}/platform/experiments/${id}/analysis/visualizations/new`)
          }
          disabled={!hasAccess}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          {t("ui.actions.create")}
        </Button>
      </div>

      <ExperimentVisualizationsList
        visualizations={visualizationsData?.body ?? []}
        experimentId={id}
        isLoading={isLoading}
      />
    </div>
  );
}
