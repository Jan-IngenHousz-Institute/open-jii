"use client";

import type { SampleTable } from "@/hooks/experiment/useExperimentData/useExperimentData";
import { useExperimentVisualizationUpdate } from "@/hooks/experiment/useExperimentVisualizationUpdate/useExperimentVisualizationUpdate";
import { Loader2 } from "lucide-react";

import type { ExperimentVisualization } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { WizardForm } from "@repo/ui/components";
import type { WizardStepProps } from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import type { ChartFormValues } from "./chart-configurators/chart-configurator-util";
import { getDefaultChartConfig } from "./chart-configurators/chart-configurator-util";
import { AppearanceStep, appearanceSchema } from "./wizard-steps/appearance-step";
// Import wizard steps
import { BasicInfoStep, basicInfoSchema } from "./wizard-steps/basic-info-step";
import { ChartTypeStep, chartTypeSchema } from "./wizard-steps/chart-type-step";
import { DataSourceStep, dataSourceSchema } from "./wizard-steps/data-source-step";

interface EditVisualizationFormProps {
  experimentId: string;
  visualization: ExperimentVisualization;
  sampleTables: SampleTable[];
  onSuccess: (visualizationId: string) => void;
  isLoading?: boolean;
  isPreviewOpen: boolean;
  onPreviewClose: () => void;
}

export default function EditVisualizationForm({
  experimentId,
  visualization,
  sampleTables,
  onSuccess,
  isLoading: isLoadingTables = false,
  isPreviewOpen = false,
  onPreviewClose,
}: EditVisualizationFormProps) {
  const { t } = useTranslation("experimentVisualizations");

  // Update visualization mutation
  const { mutate: updateVisualization, isPending } = useExperimentVisualizationUpdate({
    experimentId,
    onSuccess: (updatedVisualization) => {
      toast({ description: t("ui.messages.updateSuccess") });
      onSuccess(updatedVisualization.id);
    },
  });

  // Form default values from existing visualization with merged defaults
  const defaultValues: Partial<ChartFormValues> = {
    name: visualization.name,
    description: visualization.description ?? "",
    chartFamily: visualization.chartFamily,
    chartType: visualization.chartType,
    config: {
      ...getDefaultChartConfig(visualization.chartType),
      ...visualization.config,
    },
    dataConfig: visualization.dataConfig,
  };

  // Wizard steps configuration
  const steps = [
    {
      title: t("wizard.steps.basicInfo.title"),
      description: t("wizard.steps.basicInfo.description"),
      validationSchema: basicInfoSchema,
      component: (props: WizardStepProps<ChartFormValues>) => (
        <BasicInfoStep
          {...props}
          experimentId={experimentId}
          isPreviewOpen={isPreviewOpen}
          onPreviewClose={onPreviewClose}
        />
      ),
    },
    {
      title: t("wizard.steps.chartType.title"),
      description: t("wizard.steps.chartType.description"),
      validationSchema: chartTypeSchema,
      component: (props: WizardStepProps<ChartFormValues>) => (
        <ChartTypeStep
          {...props}
          experimentId={experimentId}
          isPreviewOpen={isPreviewOpen}
          onPreviewClose={onPreviewClose}
        />
      ),
    },
    {
      title: t("wizard.steps.dataSource.title"),
      description: t("wizard.steps.dataSource.description"),
      validationSchema: dataSourceSchema,
      component: (props: WizardStepProps<ChartFormValues>) => (
        <DataSourceStep
          {...props}
          tables={sampleTables}
          experimentId={experimentId}
          isPreviewOpen={isPreviewOpen}
          onPreviewClose={onPreviewClose}
        />
      ),
    },
    {
      title: t("wizard.steps.appearance.title"),
      description: t("wizard.steps.appearance.description"),
      validationSchema: appearanceSchema,
      component: (props: WizardStepProps<ChartFormValues>) => (
        <AppearanceStep
          {...props}
          isEdit={true}
          experimentId={experimentId}
          isPreviewOpen={isPreviewOpen}
          onPreviewClose={onPreviewClose}
        />
      ),
    },
  ];

  // Handle form submission
  const handleSubmit = (data: ChartFormValues) => {
    // Collect all data sources before submission
    const allDataSources = data.dataConfig.dataSources
      .filter((source) => source.columnName && source.columnName.trim() !== "")
      .map((source) => ({
        tableName: source.tableName,
        columnName: source.columnName,
        role: source.role,
        alias: source.alias,
      }));

    const updatedData = {
      ...data,
      dataConfig: {
        ...data.dataConfig,
        dataSources: allDataSources,
      },
    };

    updateVisualization({
      params: {
        id: experimentId,
        visualizationId: visualization.id,
      },
      body: updatedData,
    });
  };

  if (isLoadingTables) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <WizardForm
        steps={steps}
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
        isSubmitting={isPending}
        showStepIndicator={true}
        showStepTitles={true}
        initialStep={2}
      />
    </div>
  );
}
