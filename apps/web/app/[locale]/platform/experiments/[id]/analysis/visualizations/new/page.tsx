"use client";

import NewVisualizationForm from "@/components/experiment-visualizations/new-visualization-form";
import { useExperimentSampleData } from "@/hooks/experiment/useExperimentData/useExperimentData";
import { useLocale } from "@/hooks/useLocale";
import { Eye } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components";

export default function NewVisualizationPage() {
  const { t } = useTranslation("experimentVisualizations");
  const { id: experimentId } = useParams<{ id: string }>();
  const router = useRouter();
  const locale = useLocale();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Fetch sample data to get tables and columns
  const { sampleTables, isLoading: isLoadingTables } = useExperimentSampleData(experimentId, 5);

  // Use the sample tables directly from the API
  // This simplifies our code and avoids unnecessary transformations

  const handleSuccess = (visualizationId: string) => {
    router.push(
      `/${locale}/platform/experiments/${experimentId}/analysis/visualizations/${visualizationId}`,
    );
  };

  return (
    <div className="space-y-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold text-gray-900">{t("ui.actions.create")}</h1>
        <Button
          variant="outline"
          size="default"
          onClick={() => setIsPreviewOpen(true)}
          className="flex items-center gap-2"
        >
          <Eye className="h-5 w-5" />
          {t("preview.title")}
        </Button>
      </div>

      <NewVisualizationForm
        experimentId={experimentId}
        sampleTables={sampleTables}
        onSuccess={handleSuccess}
        isLoading={isLoadingTables}
        isPreviewOpen={isPreviewOpen}
        onPreviewClose={() => setIsPreviewOpen(false)}
      />
    </div>
  );
}
