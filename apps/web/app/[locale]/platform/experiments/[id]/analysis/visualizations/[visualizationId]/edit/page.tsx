"use client";

import EditVisualizationForm from "@/components/experiment-visualizations/edit-visualization-form";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { useExperimentSampleData } from "@/hooks/experiment/useExperimentData/useExperimentData";
import { useExperimentVisualization } from "@/hooks/experiment/useExperimentVisualization/useExperimentVisualization";
import { useLocale } from "@/hooks/useLocale";
import { Eye, Loader2 } from "lucide-react";
import { notFound, useParams, useRouter } from "next/navigation";
import { useState } from "react";

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
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Check if experiment is archived - redirect to 404 if so
  const { data: accessData } = useExperimentAccess(experimentId);
  const experimentData = accessData?.body.experiment;

  if (experimentData?.status === "archived") {
    notFound();
  }

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
      `/${locale}/platform/experiments/${experimentId}/analysis/visualizations/${visualizationId}`,
    );
  };

  // Handle loading state
  if (isLoadingVisualization || isLoadingTables) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("ui.actions.edit")}</h1>
          </div>
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("ui.actions.edit")}</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsPreviewOpen(true)}
          className="flex items-center gap-2"
        >
          <Eye className="h-4 w-4" />
          {t("preview.title")}
        </Button>
      </div>

      <EditVisualizationForm
        experimentId={experimentId}
        visualization={visualization}
        sampleTables={sampleTables}
        onSuccess={handleSuccess}
        isLoading={isLoadingTables}
        isPreviewOpen={isPreviewOpen}
        onPreviewClose={() => setIsPreviewOpen(false)}
      />
    </div>
  );
}
