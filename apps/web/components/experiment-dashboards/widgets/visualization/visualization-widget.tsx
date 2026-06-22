"use client";

import { BarChart3 } from "lucide-react";

import type { VisualizationWidget } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";

import { WidgetEmptyState } from "../shell/widget-empty-state";
import { LoadedVisualizationView } from "./loaded-visualization-view";

interface VisualizationWidgetViewProps {
  widget: VisualizationWidget;
  experimentId: string;
}

export default function VisualizationWidgetView({
  widget,
  experimentId,
}: VisualizationWidgetViewProps) {
  const { t } = useTranslation("experimentDashboards");
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
  return (
    <LoadedVisualizationView
      widget={widget}
      visualizationId={visualizationId}
      experimentId={experimentId}
    />
  );
}
