"use client";

import type { ChartFormValues } from "@/components/experiment-visualizations/charts/form-values";
import { lineChartType } from "@/components/experiment-visualizations/charts/line";
import { getChartTypeDef } from "@/components/experiment-visualizations/charts/registry";
import { VisualizationSaveProvider } from "@/components/experiment-visualizations/workspace/save-context";
import { useAutosave } from "@/components/experiment-visualizations/workspace/use-autosave";
import { VisualizationLayoutContent } from "@/components/experiment-visualizations/workspace/visualization-layout-content";
import { EntityLayoutShell } from "@/components/shared/entity-layout-shell";
import { useExperimentAccess } from "@/hooks/experiment/useExperimentAccess/useExperimentAccess";
import { useExperimentVisualization } from "@/hooks/experiment/useExperimentVisualization/useExperimentVisualization";
import { zodResolver } from "@hookform/resolvers/zod";
import { notFound, useParams } from "next/navigation";
import { useMemo } from "react";
import { FormProvider, useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";

import type { ExperimentVisualization } from "@repo/api/schemas/experiment.schema";
import { zCreateExperimentVisualizationBody } from "@repo/api/schemas/experiment.schema";
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
  const def = getChartTypeDef(visualization.chartType) ?? lineChartType;
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
    resolver: zodResolver(
      zCreateExperimentVisualizationBody,
    ) as unknown as Resolver<ChartFormValues>,
    mode: "onChange",
  });

  return (
    <VisualizationSaveProvider>
      <AutosaveBinding form={form} experimentId={experimentId} visualizationId={visualization.id} />
      <FormProvider {...form}>
        <VisualizationLayoutContent experimentId={experimentId} visualization={visualization}>
          {children}
        </VisualizationLayoutContent>
      </FormProvider>
    </VisualizationSaveProvider>
  );
}

// Mounted inside `VisualizationSaveProvider` so `useVisualizationSaveStatus()`
// inside `useAutosave` resolves to the provider state, not the default
// noop value. Without this seam, every save was firing but the indicator
// never updated.
function AutosaveBinding({
  form,
  experimentId,
  visualizationId,
}: {
  form: ReturnType<typeof useForm<ChartFormValues>>;
  experimentId: string;
  visualizationId: string;
}) {
  useAutosave({ form, experimentId, visualizationId });
  return null;
}
