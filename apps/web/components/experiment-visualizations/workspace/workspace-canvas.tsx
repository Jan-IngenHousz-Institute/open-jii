"use client";

import { BarChart3, Loader2 } from "lucide-react";
import { useMemo } from "react";
import type { Control } from "react-hook-form";
import { useWatch } from "react-hook-form";

import type { ExperimentVisualization } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";

import { useExperimentVisualizationData } from "../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";
import "../../../styles/plotly-chart.css";
import type { ChartFormValues } from "../charts/form-values";
import { dataSourcesByRole } from "../charts/form-values";
import { getChartTypeDef } from "../charts/registry";

interface WorkspaceCanvasProps {
  control: Control<ChartFormValues>;
  experimentId: string;
  visualizationId?: string;
}

// Pinned timestamps for the preview-only visualization. Re-deriving with
// `new Date().toISOString()` on every render meant `previewVisualization`
// always had a fresh identity, defeating downstream memoization. The values
// are never read by the renderer for preview mode but the schema requires
// them; pick a stable sentinel.
const PREVIEW_TIMESTAMP = "1970-01-01T00:00:00.000Z";

export function WorkspaceCanvas({ control, experimentId, visualizationId }: WorkspaceCanvasProps) {
  const { t } = useTranslation("experimentVisualizations");

  // Subscribe to the precise slices the canvas depends on. A bare
  // `useWatch({ control })` re-renders the canvas on every keystroke in
  // unrelated fields (description, name) and forces Plotly to redraw.
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
  // Render as soon as one column is configured. The renderers handle the
  // partial-config UX: X-only is treated as a Y series with synthesized X
  // index; Y-only synthesizes X from row indices. `validateDataConfig` is
  // intentionally NOT used here — that contract is the stricter "ready to
  // save" check, while the canvas wants the more permissive "ready to draw".
  const hasAnyColumn = configuredSources.length > 0;
  const isReady = Boolean(def) && Boolean(tableName) && hasAnyColumn;

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
          orderBy: xColumn,
          orderDirection: "ASC",
        }
      : { tableName: "", columns: [] },
    isReady,
  );

  // Memoize the preview visualization so the renderer (and Plotly underneath)
  // can skip work when only an unrelated form field changed. Identity flips
  // exactly when chartType/family/dataConfig/config/name/description change.
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

  if (!def) {
    return (
      <CanvasPlaceholder
        title={t("errors.unsupportedChartType")}
        body={t("errors.chartTypeNotSupported")}
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

  // Surface fetch failures here instead of falling through with `undefined`
  // rows. Forwarding undefined makes the renderer's `useChartData` think
  // no provider gave it data, so it subscribes to the same query key —
  // TanStack then refetches because the query is in error state, kicking
  // off a fresh retry pipeline. Two pipelines means twice the retries.
  if (fetchError) {
    return (
      <CanvasPlaceholder
        title={t("errors.failedToLoadData")}
        body={t(
          "workspace.canvas.fetchErrorBody",
          "The query couldn't run with the current data configuration. Try a different column or table.",
        )}
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
