"use client";

import { useExperimentVisualizations } from "@/hooks/experiment/useExperimentVisualizations/useExperimentVisualizations";
import { useLocale } from "@/hooks/useLocale";
import { PlusCircle } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import ExperimentVisualizationsList from "~/components/experiment-visualizations/experiment-visualizations-list";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components";

export default function ExperimentVisualizationsPage() {
  const { t } = useTranslation("experimentVisualizations");
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const locale = useLocale();

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
