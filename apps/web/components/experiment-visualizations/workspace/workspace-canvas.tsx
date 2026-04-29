"use client";

import "../../../styles/plotly-chart.css";

import { BarChart3, Loader2 } from "lucide-react";
import { useMemo } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import type { ExperimentVisualization } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";

import { useExperimentVisualizationData } from "../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";
import type { ChartFormValues } from "../charts/form-values";
import { dataSourcesByRole } from "../charts/form-values";
import { getChartTypeDef } from "../charts/registry";

interface WorkspaceCanvasProps {
  form: UseFormReturn<ChartFormValues>;
  experimentId: string;
  visualizationId?: string;
}

export function WorkspaceCanvas({ form, experimentId, visualizationId }: WorkspaceCanvasProps) {
  const { t } = useTranslation("experimentVisualizations");

  const values = useWatch({ control: form.control }) as ChartFormValues;

  const tableName = values.dataConfig?.tableName ?? "";
  const dataSources = values.dataConfig?.dataSources ?? [];
  const configuredSources = useMemo(
    () => dataSources.filter((ds) => Boolean(ds.columnName)),
    [dataSources],
  );
  const xColumn = dataSourcesByRole(configuredSources, "x")[0]?.source.columnName;

  const def = getChartTypeDef(values.chartType);
  const hasAnyColumn = configuredSources.length > 0;
  const isReady = Boolean(def) && Boolean(tableName) && hasAnyColumn;

  const { data: fetched, isLoading } = useExperimentVisualizationData(
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
      <div className="bg-muted/20 flex h-[480px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        <span className="text-muted-foreground text-sm">{t("workspace.canvas.loading")}</span>
      </div>
    );
  }

  const previewVisualization: ExperimentVisualization = {
    id: visualizationId ?? "preview",
    name: values.name || t("workspace.canvas.previewName"),
    description: values.description ?? "",
    experimentId,
    chartType: values.chartType,
    chartFamily: values.chartFamily,
    dataConfig: { ...values.dataConfig, dataSources: configuredSources },
    config: values.config as unknown as Record<string, unknown>,
    createdBy: "preview-user",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const Renderer = def.Renderer;

  return (
    <div className="bg-card flex h-[480px] flex-col overflow-hidden rounded-lg border p-4">
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
    <div className="bg-muted/20 flex h-[480px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center">
      <BarChart3 className="text-muted-foreground/60 h-10 w-10" />
      <div className="text-foreground font-medium">{title}</div>
      <div className="text-muted-foreground text-sm">{body}</div>
    </div>
  );
}
