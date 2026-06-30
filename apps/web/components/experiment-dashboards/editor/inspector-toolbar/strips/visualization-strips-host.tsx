"use client";

import { useExperimentData } from "@/hooks/experiment/useExperimentData/useExperimentData";
import { useExperimentTables } from "@/hooks/experiment/useExperimentTables/useExperimentTables";
import { useExperimentVisualization } from "@/hooks/experiment/useExperimentVisualization/useExperimentVisualization";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";
import { FormProvider, useForm } from "react-hook-form";

import type { ExperimentVisualization } from "@repo/api/domains/experiment/experiment.schema";
import { isPlottableColumn } from "@repo/api/transforms/column-type-utils";
import { useTranslation } from "@repo/i18n";

import type { ChartFormValues } from "../../../../experiment-visualizations/charts/chart-config";
import { chartFormResolver } from "../../../../experiment-visualizations/charts/chart-config";
import { getChartTypeDef } from "../../../../experiment-visualizations/charts/chart-registry";
import { DataSourcesFieldArrayProvider } from "../../../../experiment-visualizations/workspace/context/data-sources-field-array-context";
import { useVisualizationAutosave } from "../../../../experiment-visualizations/workspace/hooks/use-visualization-autosave";
import { useLiveVizPreview } from "../../hooks/use-live-viz-preview";
import { VisualizationDataStrip } from "./visualization-data-strip";
import { VisualizationStyleStrip } from "./visualization-style-strip";

export type VisualizationStripSection = "data" | "style";

interface VisualizationStripsHostProps {
  visualizationId: string | undefined;
  experimentId: string;
  section: VisualizationStripSection;
}

export function VisualizationStripsHost({
  visualizationId,
  experimentId,
  section,
}: VisualizationStripsHostProps) {
  const { t } = useTranslation("experimentDashboards");

  if (!visualizationId) {
    return <HintChip text={t("editor.inspector.viz.pickVisualizationFirst")} />;
  }

  // No nested AutosaveStatusProvider: a fresh provider would shadow the
  // outer one and hide viz saves from the dashboard-level indicator.
  return (
    <Loader
      key={visualizationId}
      visualizationId={visualizationId}
      experimentId={experimentId}
      section={section}
    />
  );
}

interface LoaderProps {
  visualizationId: string;
  experimentId: string;
  section: VisualizationStripSection;
}

function Loader({ visualizationId, experimentId, section }: LoaderProps) {
  const { t } = useTranslation("experimentDashboards");
  const { t: tViz } = useTranslation("experimentVisualizations");
  const { data, isLoading, error } = useExperimentVisualization(visualizationId, experimentId);

  if (isLoading) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1.5 px-2 text-xs">
        <Loader2 className="size-3.5 animate-spin" />
        {t("ui.messages.loading")}
      </span>
    );
  }

  if (error || !data) {
    return <HintChip text={tViz("errors.failedToLoadData")} />;
  }

  return <FormHost visualization={data} experimentId={experimentId} section={section} />;
}

interface FormHostProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  section: VisualizationStripSection;
}

function FormHost({ visualization, experimentId, section }: FormHostProps) {
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
        <SectionBody
          form={form}
          experimentId={experimentId}
          tableName={visualization.dataConfig.tableName}
          section={section}
        />
      </DataSourcesFieldArrayProvider>
    </FormProvider>
  );
}

interface SectionBodyProps {
  form: ReturnType<typeof useForm<ChartFormValues>>;
  experimentId: string;
  tableName: string;
  section: VisualizationStripSection;
}

function SectionBody({ form, experimentId, tableName, section }: SectionBodyProps) {
  const {
    tables,
    isLoading: isLoadingTables,
    error: tablesError,
  } = useExperimentTables(experimentId);
  const {
    tableMetadata,
    isLoading: isColumnsLoading,
    error: columnsError,
  } = useExperimentData({
    experimentId,
    page: 1,
    pageSize: 1,
    tableName,
    enabled: Boolean(tableName),
  });
  const columns = useMemo(
    () => (tableMetadata?.rawColumns ?? []).filter((col) => isPlottableColumn(col.type_text)),
    [tableMetadata],
  );

  const handleTableChange = (newTable: string) => {
    const currentDataSources = form.getValues("dataConfig.dataSources");
    const reset = currentDataSources.map((ds) => ({
      ...ds,
      tableName: newTable,
      columnName: "",
      alias: "",
      aggregate: undefined,
    }));
    form.setValue("dataConfig.tableName", newTable, { shouldDirty: true });
    form.setValue("dataConfig.dataSources", reset, { shouldDirty: true });
    form.setValue("dataConfig.aggregation", undefined, { shouldDirty: true });
    form.setValue("dataConfig.filters", undefined, { shouldDirty: true });
    form.setValue("config.xAxisTitle", "", { shouldDirty: true });
    form.setValue("config.yAxisTitle", "", { shouldDirty: true });
  };

  if (section === "data") {
    return (
      <VisualizationDataStrip
        form={form}
        experimentId={experimentId}
        tables={tables ?? []}
        isTablesLoading={isLoadingTables}
        tablesError={tablesError}
        selectedTableName={tableName}
        onTableChange={handleTableChange}
        columns={columns}
        isColumnsLoading={isColumnsLoading || isLoadingTables}
        columnsError={columnsError}
      />
    );
  }

  return <VisualizationStyleStrip form={form} columns={columns} />;
}

function HintChip({ text }: { text: string }) {
  return (
    <span className="text-muted-foreground inline-flex items-center px-2 text-xs">{text}</span>
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
