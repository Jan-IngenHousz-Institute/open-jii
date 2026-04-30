"use client";

import { useExperimentVisualization } from "@/hooks/experiment/useExperimentVisualization/useExperimentVisualization";
import { AlertCircle, BarChart3 } from "lucide-react";

import type { VisualizationWidget } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";

import ExperimentVisualizationRenderer from "../../experiment-visualizations/experiment-visualization-renderer";
import { WidgetEmptyState } from "./widget-empty-state";

interface VisualizationWidgetViewProps {
  widget: VisualizationWidget;
  experimentId: string;
}

/**
 * Visualization widget — looks up the referenced chart by id and renders it
 * via the existing `<ExperimentVisualizationRenderer>`. Charts are a
 * first-class entity; this widget is purely a reference, so editing the
 * underlying viz updates every dashboard that embeds it.
 *
 * Draft state (no `visualizationId` yet) is delegated to a placeholder so
 * the data-fetch hook stays unconditional in the loaded view.
 */
export function VisualizationWidgetView({ widget, experimentId }: VisualizationWidgetViewProps) {
  const visualizationId = widget.config.visualizationId;
  if (!visualizationId) return <UnpickedPlaceholder />;
  return (
    <LoadedVisualizationView
      visualizationId={visualizationId}
      experimentId={experimentId}
      showTitle={widget.config.showTitle ?? true}
      showDescription={widget.config.showDescription ?? false}
    />
  );
}

function UnpickedPlaceholder() {
  const { t } = useTranslation("experimentDashboards");
  return (
    <WidgetEmptyState
      icon={BarChart3}
      title={t("widget.emptyVisualization")}
      description={t("widget.emptyVisualizationDescription")}
    />
  );
}

interface LoadedVisualizationViewProps {
  visualizationId: string;
  experimentId: string;
  showTitle: boolean;
  showDescription: boolean;
}

function LoadedVisualizationView({
  visualizationId,
  experimentId,
  showTitle,
  showDescription,
}: LoadedVisualizationViewProps) {
  const { t } = useTranslation("experimentDashboards");
  const { data, isLoading, error } = useExperimentVisualization(visualizationId, experimentId);

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        {t("ui.messages.loading")}
      </div>
    );
  }

  if (error || !data?.body) {
    return (
      <WidgetEmptyState
        icon={AlertCircle}
        title={t("widget.missingVisualization")}
        description={t("widget.missingVisualizationDescription")}
      />
    );
  }

  return (
    <ExperimentVisualizationRenderer
      visualization={data.body}
      experimentId={experimentId}
      showTitle={showTitle}
      showDescription={showDescription}
    />
  );
}
