"use client";

import EditVisualizationForm from "@/components/experiment-visualizations/edit-visualization-form";
import { useExperimentSampleData } from "@/hooks/experiment/useExperimentData/useExperimentData";
import { useExperimentVisualization } from "@/hooks/experiment/useExperimentVisualization/useExperimentVisualization";
import { useLocale } from "@/hooks/useLocale";
import { ChevronLeft, Loader2 } from "lucide-react";
import { notFound, useParams, useRouter } from "next/navigation";

import { useTranslation } from "@repo/i18n";
import { Button, Card, CardContent } from "@repo/ui/components";

export default function EditVisualizationPage() {
  const { t } = useTranslation("experimentVisualizations");
  const { id: experimentId, visualizationId } = useParams<{
    id: string;
    visualizationId: string;
  }>();
  const router = useRouter();
  const locale = useLocale();

  // Fetch the visualization data
  const {
    data: visualizationResponse,
    isLoading: isLoadingVisualization,
    error: visualizationError,
  } = useExperimentVisualization(visualizationId, experimentId);

  const visualization = visualizationResponse?.body;

  // Fetch sample data to get tables and columns
  const { sampleTables, isLoading: isLoadingTables } = useExperimentSampleData(experimentId, 5);

  const handleSuccess = (_visualizationId: string) => {
    router.push(
      `/${locale}/platform/experiments/${experimentId}/visualizations/${visualizationId}`,
    );
  };

  const handleCancel = () => {
    router.push(
      `/${locale}/platform/experiments/${experimentId}/visualizations/${visualizationId}`,
    );
  };

  // Handle loading state
  if (isLoadingVisualization || isLoadingTables) {
    return (
      <div className="container mx-auto py-8">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            {t("back")}
          </Button>
          <h1 className="text-2xl font-bold">{t("editVisualization")}</h1>
        </div>

        <Card>
          <CardContent className="flex justify-center py-20">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle error state
  if (visualizationError || !visualization) {
    notFound();
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={handleCancel}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          {t("back")}
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{t("editVisualization")}</h1>
          <p className="text-muted-foreground">{visualization.name}</p>
        </div>
      </div>

      <EditVisualizationForm
        experimentId={experimentId}
        visualization={visualization}
        sampleTables={sampleTables}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
        isLoading={isLoadingTables}
      />
    </div>
  );
}
