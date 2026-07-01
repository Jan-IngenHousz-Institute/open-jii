"use client";

import { useExperimentVisualization } from "@/hooks/experiment/useExperimentVisualization/useExperimentVisualization";
import { AlertCircle } from "lucide-react";
import { useMemo } from "react";

import type { ExperimentVisualizationWidget } from "@repo/api/domains/experiment/experiment.schema";
import type { ExperimentVisualization } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
import { useTranslation } from "@repo/i18n";

import ExperimentVisualizationRenderer from "../../../experiment-visualizations/experiment-visualization-renderer";
import { useLiveViz } from "../../editor/context/live-viz-context";
import { ExpandableWidget } from "../shell/expandable-widget";
import { WidgetEmptyState } from "../shell/widget-empty-state";
import { WidgetHeader } from "../shell/widget-header";

export interface LoadedVisualizationViewProps {
  widget: ExperimentVisualizationWidget;
  visualizationId: string;
  experimentId: string;
}

export function LoadedVisualizationView({
  widget,
  visualizationId,
  experimentId,
}: LoadedVisualizationViewProps) {
  const { t } = useTranslation("experimentDashboards");
  const { data, isLoading, error } = useExperimentVisualization(visualizationId, experimentId);
  const live = useLiveViz();

  // Prefer live form values over the server snapshot when the toolbar
  // is editing this viz, so edits land instantly without waiting for
  // autosave + network round-trip.
  const body = useMemo<ExperimentVisualization | undefined>(() => {
    const server = data;
    if (!server) return undefined;
    if (live?.vizId !== visualizationId) return server;
    // Drop draft data sources so the renderer's query doesn't 400
    // on half-edited configs.
    const configuredSources = live.values.dataConfig.dataSources.filter((ds) =>
      Boolean(ds.columnName),
    );
    return {
      ...server,
      name: live.values.name,
      description: live.values.description ?? null,
      chartFamily: live.values.chartFamily,
      chartType: live.values.chartType,
      config: { ...live.values.config },
      dataConfig: { ...live.values.dataConfig, dataSources: configuredSources },
    };
  }, [data, live, visualizationId]);

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        {t("ui.messages.loading")}
      </div>
    );
  }

  if (error || !body) {
    return (
      <WidgetEmptyState
        icon={AlertCircle}
        title={t("widget.missingVisualization")}
        description={t("widget.missingVisualizationDescription")}
      />
    );
  }

  const titleOverride = widget.config.title?.trim();
  const descriptionOverride = widget.config.description?.trim();
  const title = widget.config.showTitle ? (titleOverride ?? body.name) : undefined;
  const description = widget.config.showDescription
    ? (descriptionOverride ?? body.description ?? undefined)
    : undefined;
  const hasHeader = Boolean(title ?? description);

  return (
    <ExpandableWidget title={title ?? body.name}>
      <div className="flex h-full min-h-0 flex-1 flex-col">
        {hasHeader && (
          <WidgetHeader
            className="border-b px-3 pb-2 pt-3"
            title={title}
            description={description}
          />
        )}
        <div className="flex min-h-0 flex-1 flex-col">
          <ExperimentVisualizationRenderer
            visualization={body}
            experimentId={experimentId}
            showTitle={false}
            showDescription={false}
          />
        </div>
      </div>
    </ExpandableWidget>
  );
}
