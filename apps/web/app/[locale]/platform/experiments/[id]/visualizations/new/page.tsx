"use client";

import NewVisualizationForm from "@/components/experiment-visualizations/new-visualization-form";
import { useExperimentSampleData } from "@/hooks/experiment/useExperimentData/useExperimentData";
import { useLocale } from "@/hooks/useLocale";
import { ChevronLeft } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components";

export default function NewVisualizationPage() {
  const { t } = useTranslation("experimentVisualizations");
  const { id: experimentId } = useParams<{ id: string }>();
  const router = useRouter();
  const locale = useLocale();

  // Fetch sample data to get tables and columns
  const { sampleTables, isLoading: isLoadingTables } = useExperimentSampleData(experimentId, 5);

  // Use the sample tables directly from the API
  // This simplifies our code and avoids unnecessary transformations

  const handleSuccess = (visualizationId: string) => {
    router.push(
      `/${locale}/platform/experiments/${experimentId}/visualizations/${visualizationId}`,
    );
  };

  const handleCancel = () => {
    router.push(`/${locale}/platform/experiments/${experimentId}/visualizations`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            {t("back")}
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{t("newVisualization")}</h1>
        </div>
      </div>

      <NewVisualizationForm
        experimentId={experimentId}
        sampleTables={sampleTables}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
        isLoading={isLoadingTables}
      />
    </div>
  );
}
