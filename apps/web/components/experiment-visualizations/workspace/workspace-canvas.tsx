"use client";

import { BarChart3, Loader2 } from "lucide-react";
import { useMemo } from "react";
import type { Control } from "react-hook-form";
import { useWatch } from "react-hook-form";

import type { ExperimentVisualization } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";

import { useExperimentVisualizationData } from "../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";
import "../../../styles/plotly-chart.css";
import type { ChartFormValues } from "../charts/chart-config";
import { getChartTypeDef } from "../charts/chart-registry";
import { dataSourcesByRole } from "../charts/data/data-sources";

interface WorkspaceCanvasProps {
  control: Control<ChartFormValues>;
  experimentId: string;
  visualizationId?: string;
}

// Stable sentinel so previewVisualization identity holds across renders.
const PREVIEW_TIMESTAMP = "1970-01-01T00:00:00.000Z";

export function WorkspaceCanvas({ control, experimentId, visualizationId }: WorkspaceCanvasProps) {
  const { t } = useTranslation("experimentVisualizations");

  // Slice-level watch; bare `useWatch({ control })` would force a Plotly redraw per keystroke.
  const chartType = useWatch({ control, name: "chartType" });
  const chartFamily = useWatch({ control, name: "chartFamily" });
  const dataConfig = useWatch({ control, name: "dataConfig" });
  const config = useWatch({ control, name: "config" });
  const name = useWatch({ control, name: "name" });
  const description = useWatch({ control, name: "description" });

  const tableName = dataConfig.tableName;
  const configuredSources = useMemo(
    () => dataConfig.dataSources.filter((ds) => Boolean(ds.columnName)),
    [dataConfig.dataSources],
  );
  const xColumn = dataSourcesByRole(configuredSources, "x")[0]?.source.columnName;

  const def = getChartTypeDef(chartType);
  // Draw on first configured column; renderers synthesize the missing axis.
  const hasAnyColumn = configuredSources.length > 0;
  const isReady = Boolean(def) && Boolean(tableName) && hasAnyColumn;

  const aggregation = dataConfig.aggregation;
  const filters = dataConfig.filters;
  // Keep color/facet columns through aggregation so renderer can split traces.
  const colorColumn = dataSourcesByRole(configuredSources, "color")[0]?.source.columnName;
  const facetColumn = dataSourcesByRole(configuredSources, "facet")[0]?.source.columnName;
  const extraSplitColumns = [colorColumn, facetColumn].filter(
    (col): col is string => typeof col === "string" && col.length > 0,
  );
  const extraGroupByColumns = extraSplitColumns.length > 0 ? extraSplitColumns : undefined;

  const {
    data: fetched,
    isLoading,
    error: fetchError,
  } = useExperimentVisualizationData(
    experimentId,
    tableName
      ? {
          tableName,
          columns: configuredSources.map((ds) => ds.columnName),
          filters,
          aggregation,
          extraGroupByColumns,
          // Hook resolves to alias under aggregation, or drops if not projected.
          orderBy: xColumn,
          orderDirection: xColumn ? "ASC" : undefined,
        }
      : { tableName: "", columns: [] },
    isReady,
  );

  const previewVisualization = useMemo<ExperimentVisualization>(
    () => ({
      id: visualizationId ?? "preview",
      name: name || t("workspace.canvas.previewName"),
      description: description ?? "",
      experimentId,
      chartType,
      chartFamily,
      dataConfig: { ...dataConfig, dataSources: configuredSources },
      config: config as unknown as Record<string, unknown>,
      createdBy: "preview-user",
      createdAt: PREVIEW_TIMESTAMP,
      updatedAt: PREVIEW_TIMESTAMP,
    }),
    [
      visualizationId,
      name,
      description,
      experimentId,
      chartType,
      chartFamily,
      dataConfig,
      configuredSources,
      config,
      t,
    ],
  );

  if (!tableName) {
    return (
      <CanvasPlaceholder
        title={t("workspace.canvas.noTable")}
        body={t("workspace.canvas.selectTable")}
      />
    );
  }

  if (!hasAnyColumn) {
    return (
      <CanvasPlaceholder
        title={t("workspace.canvas.noColumns")}
        body={t("workspace.canvas.configureColumns")}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="bg-muted/20 flex h-[clamp(420px,60vh,640px)] flex-col items-center justify-center gap-3 rounded-lg border border-dashed">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        <span className="text-muted-foreground text-sm">{t("workspace.canvas.loading")}</span>
      </div>
    );
  }

  // Surface fetch failures here; forwarding undefined would double-subscribe.
  if (fetchError) {
    return (
      <CanvasPlaceholder
        title={t("errors.failedToLoadData")}
        body={t("workspace.canvas.fetchErrorBody")}
      />
    );
  }

  const Renderer = def.Renderer;

  return (
    <div className="bg-card flex h-[clamp(420px,60vh,640px)] flex-col overflow-hidden rounded-lg border p-4">
      <Renderer
        visualization={previewVisualization}
        experimentId={experimentId}
        data={fetched?.rows}
      />
    </div>
  );
}

function CanvasPlaceholder({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-muted/20 flex h-[clamp(420px,60vh,640px)] flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center">
      <BarChart3 className="text-muted-foreground/60 h-10 w-10" />
      <div className="text-foreground font-medium">{title}</div>
      <div className="text-muted-foreground text-sm">{body}</div>
    </div>
  );
}
