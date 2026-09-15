"use client";

import { useExperimentVisualizationIndex } from "@/hooks/experiment/useExperimentVisualizationIndex/useExperimentVisualizationIndex";
import { BarChart3 } from "lucide-react";

import type { ExperimentVisualizationWidget } from "@repo/api/domains/experiment/dashboards/experiment-dashboards.schema";
import { useTranslation } from "@repo/i18n";

import { WidgetEmptyState } from "../shell/widget-empty-state";
import { WidgetLoading } from "../shell/widget-loading";
import { LoadedVisualizationView } from "./loaded-visualization-view";

interface VisualizationWidgetViewProps {
  widget: ExperimentVisualizationWidget;
  experimentId: string;
}

export default function VisualizationWidgetView({
  widget,
  experimentId,
}: VisualizationWidgetViewProps) {
  const { t } = useTranslation("experimentDashboards");
  // One list read serves every widget on the dashboard; the loaded view then
  // finds its row in the cache instead of making its own request.
  const index = useExperimentVisualizationIndex(experimentId);
  const visualizationId = widget.config.visualizationId;
  if (!visualizationId) {
    return (
      <WidgetEmptyState
        icon={BarChart3}
        title={t("widget.emptyVisualization")}
        description={t("widget.emptyVisualizationDescription")}
      />
    );
  }
  if (index.isPending) {
    return <WidgetLoading />;
  }
  return (
    <LoadedVisualizationView
      widget={widget}
      visualizationId={visualizationId}
      experimentId={experimentId}
    />
  );
}
