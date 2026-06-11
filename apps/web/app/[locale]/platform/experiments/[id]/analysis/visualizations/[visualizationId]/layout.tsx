"use client";

import type { ChartFormValues } from "@/components/experiment-visualizations/charts/chart-config";
import { chartFormResolver } from "@/components/experiment-visualizations/charts/chart-config";
import { getChartTypeDef } from "@/components/experiment-visualizations/charts/chart-registry";
import { DataSourcesFieldArrayProvider } from "@/components/experiment-visualizations/workspace/context/data-sources-field-array-context";
import { useVisualizationAutosave } from "@/components/experiment-visualizations/workspace/hooks/use-visualization-autosave";
import { VisualizationLayoutContent } from "@/components/experiment-visualizations/workspace/layout/visualization-layout-content";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { useExperimentVisualization } from "@/hooks/experiment/useExperimentVisualization/useExperimentVisualization";
import { AutosaveStatusProvider } from "@/shared/ui/autosave/autosave-status-context";
import { EntityLayoutShell } from "@/shared/ui/entity-layout-shell";
import { notFound, useParams } from "next/navigation";
import { useMemo } from "react";
import { FormProvider, useForm } from "react-hook-form";

import type { ExperimentVisualization } from "@repo/api/schemas/experiment.schema";
import { useTranslation } from "@repo/i18n";

interface LayoutProps {
  children: React.ReactNode;
}

export default function VisualizationLayout({ children }: LayoutProps) {
  const { id: experimentId, visualizationId } = useParams<{
    id: string;
    visualizationId: string;
  }>();
  const { t } = useTranslation("common");

  const { data: accessData } = useExperimentAccess(experimentId);
  const { data, isLoading, error } = useExperimentVisualization(visualizationId, experimentId);

  if (accessData?.body.experiment.status === "archived") {
    notFound();
  }

  return (
    <div className="visualization-page flex flex-1 flex-col">
      <EntityLayoutShell
        isLoading={isLoading}
        error={error}
        hasData={Boolean(data?.body)}
        loadingMessage={t("common.loading")}
      >
        {data?.body && (
          <VisualizationFormShell
            key={data.body.id}
            experimentId={experimentId}
            visualization={data.body}
          >
            {children}
          </VisualizationFormShell>
        )}
      </EntityLayoutShell>
    </div>
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

function VisualizationFormShell({
  experimentId,
  visualization,
  children,
}: {
  experimentId: string;
  visualization: ExperimentVisualization;
  children: React.ReactNode;
}) {
  const defaults = useMemo(() => buildDefaults(visualization), [visualization]);

  const form = useForm<ChartFormValues>({
    defaultValues: defaults,
    resolver: chartFormResolver,
    mode: "onChange",
  });

  return (
    <AutosaveStatusProvider>
      <FormProvider {...form}>
        <AutosaveBinding
          form={form}
          experimentId={experimentId}
          visualizationId={visualization.id}
        />
        <DataSourcesFieldArrayProvider form={form}>
          <VisualizationLayoutContent experimentId={experimentId} visualization={visualization}>
            {children}
          </VisualizationLayoutContent>
        </DataSourcesFieldArrayProvider>
      </FormProvider>
    </AutosaveStatusProvider>
  );
}

function AutosaveBinding({
  form,
  experimentId,
  visualizationId,
}: {
  form: ReturnType<typeof useForm<ChartFormValues>>;
  experimentId: string;
  visualizationId: string;
}) {
  useVisualizationAutosave({ form, experimentId, visualizationId });
  return null;
}
