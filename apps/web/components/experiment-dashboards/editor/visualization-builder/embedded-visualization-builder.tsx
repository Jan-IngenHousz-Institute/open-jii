"use client";

import { useExperimentVisualization } from "@/hooks/experiment/useExperimentVisualization/useExperimentVisualization";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { FormProvider, useForm } from "react-hook-form";

import type { ExperimentVisualization } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";

import type { ChartFormValues } from "../../../experiment-visualizations/charts/chart-config";
import { chartFormResolver } from "../../../experiment-visualizations/charts/chart-config";
import { getChartTypeDef } from "../../../experiment-visualizations/charts/chart-registry";
import { DataSourcesFieldArrayProvider } from "../../../experiment-visualizations/workspace/context/data-sources-field-array-context";
import { useVisualizationAutosave } from "../../../experiment-visualizations/workspace/hooks/use-visualization-autosave";
import { AutosaveStatusProvider } from "../../../shared/autosave/autosave-status-context";
import { useLiveVizPreview } from "../hooks/use-live-viz-preview";
import { BuilderBody } from "./builder-body";

interface EmbeddedVisualizationBuilderProps {
  experimentId: string;
  visualizationId: string;
  renderWidgetTab: (chartTypePicker: ReactNode) => ReactNode;
}

// Selected canvas widget acts as the preview; this just hosts the inner form + autosave.
export function EmbeddedVisualizationBuilder({
  experimentId,
  visualizationId,
  renderWidgetTab,
}: EmbeddedVisualizationBuilderProps) {
  const { t } = useTranslation("experimentVisualizations");
  const { data, isLoading, error } = useExperimentVisualization(visualizationId, experimentId);

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 p-4 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("workspace.inspector.loadingTables")}
      </div>
    );
  }

  if (error || !data?.body) {
    return <div className="text-destructive p-4 text-sm">{t("errors.failedToLoadData")}</div>;
  }

  return (
    <AutosaveStatusProvider>
      <BuilderShell
        key={data.body.id}
        experimentId={experimentId}
        visualization={data.body}
        renderWidgetTab={renderWidgetTab}
      />
    </AutosaveStatusProvider>
  );
}

interface BuilderShellProps {
  experimentId: string;
  visualization: ExperimentVisualization;
  renderWidgetTab: (chartTypePicker: ReactNode) => ReactNode;
}

function BuilderShell({ experimentId, visualization, renderWidgetTab }: BuilderShellProps) {
  const defaults = useMemo(() => buildDefaults(visualization), [visualization]);

  const form = useForm<ChartFormValues>({
    defaultValues: defaults,
    resolver: chartFormResolver,
    mode: "onChange",
  });

  useVisualizationAutosave({ form, experimentId, visualizationId: visualization.id });
  useLiveVizPreview(form, visualization.id);

  return (
    <FormProvider {...form}>
      <DataSourcesFieldArrayProvider form={form}>
        <BuilderBody experimentId={experimentId} renderWidgetTab={renderWidgetTab} />
      </DataSourcesFieldArrayProvider>
    </FormProvider>
  );
}

function buildDefaults(visualization: ExperimentVisualization): ChartFormValues {
  const def = getChartTypeDef(visualization.chartType);
  return {
    name: visualization.name,
    description: visualization.description ?? "",
    chartFamily: visualization.chartFamily,
    chartType: visualization.chartType,
    config: { ...def.defaultConfig(), ...(visualization.config ?? {}) },
    dataConfig: visualization.dataConfig,
  };
}
