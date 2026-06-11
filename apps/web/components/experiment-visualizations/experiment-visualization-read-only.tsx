"use client";

import { useLocale } from "@/shared/i18n/useLocale";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useExperimentVisualization } from "~/hooks/experiment/useExperimentVisualization/useExperimentVisualization";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";

import ExperimentVisualizationRenderer from "./experiment-visualization-renderer";

interface Props {
  experimentId: string;
  visualizationId: string;
}

export default function ExperimentVisualizationReadOnly({ experimentId, visualizationId }: Props) {
  const { t } = useTranslation("experimentVisualizations");
  const router = useRouter();
  const locale = useLocale();

  const {
    data: visualizationResponse,
    isLoading,
    error,
  } = useExperimentVisualization(visualizationId, experimentId);
  const visualization = visualizationResponse?.body;

  const handleBack = () => {
    router.push(`/${locale}/platform/experiments-archive/${experimentId}`);
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-muted-foreground">{t("ui.messages.loading")}</div>
      </div>
    );
  }

  if (error || !visualization) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
        <div className="text-destructive">{t("ui.messages.failedToLoad")}</div>
        <Button onClick={handleBack} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("ui.actions.back")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{visualization.name}</CardTitle>
          {visualization.description && (
            <p className="text-muted-foreground mt-2">{visualization.description}</p>
          )}
        </CardHeader>
        <CardContent>
          <ExperimentVisualizationRenderer
            experimentId={experimentId}
            visualization={visualization}
            showTitle={false}
            showDescription={false}
          />
        </CardContent>
      </Card>
    </div>
  );
}
