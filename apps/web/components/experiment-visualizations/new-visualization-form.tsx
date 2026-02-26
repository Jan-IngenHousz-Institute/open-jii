"use client";

import { useExperimentVisualizationCreate } from "@/hooks/experiment/useExperimentVisualizationCreate/useExperimentVisualizationCreate";
import { Loader2 } from "lucide-react";

import type { ExperimentTableMetadata } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import type { WizardStepProps } from "@repo/ui/components";
import { WizardForm } from "@repo/ui/components";
import { toast } from "@repo/ui/hooks";

import type { ChartFormValues } from "./chart-configurators/chart-configurator-util";
import {
  getDefaultChartConfig,
  getDefaultDataConfig,
} from "./chart-configurators/chart-configurator-util";
import { AppearanceStep, appearanceSchema } from "./wizard-steps/appearance-step";
import { BasicInfoStep, basicInfoSchema } from "./wizard-steps/basic-info-step";
import { ChartTypeStep, chartTypeSchema } from "./wizard-steps/chart-type-step";
import { DataSourceStep, dataSourceSchema } from "./wizard-steps/data-source-step";

interface NewVisualizationFormProps {
  experimentId: string;
  tables: ExperimentTableMetadata[];
  tablesError?: unknown;
  onSuccess: (visualizationId: string) => void;
  isLoading?: boolean;
  isPreviewOpen: boolean;
  onPreviewClose: () => void;
}

export default function NewVisualizationForm({
  experimentId,
  tables,
  tablesError,
  onSuccess,
  isLoading: isLoadingTables = false,
  isPreviewOpen,
  onPreviewClose,
}: NewVisualizationFormProps) {
  const { t } = useTranslation("experimentVisualizations");

  // Create visualization mutation
  const { mutate: createVisualization, isPending } = useExperimentVisualizationCreate({
    experimentId,
    onSuccess: (visualization) => {
      toast({ description: t("ui.messages.createSuccess") });
      onSuccess(visualization.id);
    },
  });

  // Form default values
  const defaultValues: Partial<ChartFormValues> = {
    name: "",
    description: "",
    chartFamily: "basic",
    chartType: "line",
    config: getDefaultChartConfig("line"),
    dataConfig: getDefaultDataConfig(tables.length > 0 ? tables[0].name : undefined),
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
          tables={tables}
          tablesError={tablesError}
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
          isEdit={false}
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

    const cleanedData = {
      ...data,
      dataConfig: {
        ...data.dataConfig,
        dataSources: allDataSources,
      },
    };

    createVisualization({
      params: { id: experimentId },
      body: cleanedData,
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
      />
    </div>
  );
}
