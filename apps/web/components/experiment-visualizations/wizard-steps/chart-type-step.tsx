"use client";

import { LineChart, ScatterChart } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

import type { ExperimentVisualization } from "@repo/api";
import { zCreateExperimentVisualizationBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  RadioGroup,
  RadioGroupItem,
  WizardStepButtons,
} from "@repo/ui/components";
import type { WizardStepProps } from "@repo/ui/components";

import type { ChartFormValues } from "../chart-configurators/chart-configurator-util";
import {
  getDefaultChartConfig,
  getDefaultDataConfig,
} from "../chart-configurators/chart-configurator-util";
import { ChartPreviewModal } from "../chart-preview/chart-preview-modal";

// Step 2: Chart Type Selection
export const chartTypeSchema = zCreateExperimentVisualizationBody.pick({
  chartFamily: true,
  chartType: true,
});

// Define chart types config for UX purposes
const CHART_TYPES_CONFIG: {
  type: "line" | "scatter";
  family: "basic";
  labelKey: string;
  descriptionKey: string;
  icon: ReactNode;
}[] = [
  {
    type: "line",
    family: "basic",
    labelKey: "charts.types.line",
    descriptionKey: "charts.types.lineDescription",
    icon: <LineChart className="h-5 w-5" />,
  },
  {
    type: "scatter",
    family: "basic",
    labelKey: "charts.types.scatter",
    descriptionKey: "charts.types.scatterDescription",
    icon: <ScatterChart className="h-5 w-5" />,
  },
];

interface ChartTypeStepProps extends WizardStepProps<ChartFormValues> {
  experimentId: string;
  isPreviewOpen: boolean;
  onPreviewClose: () => void;
}

export function ChartTypeStep({
  form,
  onNext,
  onPrevious,
  stepIndex,
  totalSteps,
  isSubmitting,
  experimentId,
  isPreviewOpen,
  onPreviewClose,
}: ChartTypeStepProps) {
  const { t } = useTranslation("experimentVisualizations");
  const { t: tCommon } = useTranslation("common");

  const [selectedChartType, setSelectedChartType] = useState<ExperimentVisualization["chartType"]>(
    form.getValues("chartType"),
  );

  // Translate chart types with current locale
  const CHART_TYPES = CHART_TYPES_CONFIG.map((chartConfig) => ({
    ...chartConfig,
    label: t(chartConfig.labelKey),
    description: t(chartConfig.descriptionKey),
  }));

  // Handle chart type selection
  const handleChartTypeSelect = (chartType: "line" | "scatter") => {
    setSelectedChartType(chartType);

    // Get current form values to preserve some state
    const currentValues = form.getValues();
    const defaultConfig = getDefaultChartConfig(chartType);

    // Reset form with new values, keeping some form state
    form.reset(
      {
        ...currentValues,
        chartType,
        chartFamily: "basic",
        config: defaultConfig,
        dataConfig: getDefaultDataConfig(currentValues.dataConfig.tableName),
      },
      {
        keepDefaultValues: true,
        keepErrors: false,
        keepDirty: false,
        keepTouched: false,
      },
    );
  };

  return (
    <div className="space-y-8">
      {/* Chart Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle>{t("wizard.steps.chartType.title")}</CardTitle>
          <CardDescription>{t("wizard.steps.chartType.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-muted-foreground text-sm font-medium">
                {t("charts.families.basic")}
              </h3>

              <FormField
                control={form.control}
                name="chartType"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <RadioGroup
                        value={selectedChartType}
                        onValueChange={(value: string) => {
                          handleChartTypeSelect(value as "line" | "scatter");
                          field.onChange(value);
                        }}
                        className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                      >
                        {CHART_TYPES.map((chartType) => (
                          <FormItem key={chartType.type}>
                            <FormControl>
                              <RadioGroupItem
                                value={chartType.type}
                                id={chartType.type}
                                className="peer sr-only"
                              />
                            </FormControl>
                            <FormLabel
                              htmlFor={chartType.type}
                              className={`group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 bg-white p-6 shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md ${
                                selectedChartType === chartType.type
                                  ? "border-primary bg-primary/5 shadow-md"
                                  : "border-gray-200"
                              }`}
                            >
                              <div
                                className={`mb-3 transition-colors duration-200 group-hover:text-gray-700 ${
                                  selectedChartType === chartType.type
                                    ? "text-gray-700"
                                    : "text-gray-600"
                                }`}
                              >
                                {chartType.icon}
                              </div>
                              <span
                                className={`text-center text-sm font-medium transition-colors duration-200 ${
                                  selectedChartType === chartType.type
                                    ? "text-gray-900"
                                    : "text-gray-700 group-hover:text-gray-900"
                                }`}
                              >
                                {chartType.label}
                              </span>
                            </FormLabel>
                          </FormItem>
                        ))}
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <WizardStepButtons
        onNext={onNext}
        onPrevious={onPrevious}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        isSubmitting={isSubmitting}
        nextLabel={tCommon("experiments.next")}
        previousLabel={tCommon("experiments.back")}
      />

      {/* Chart Preview Modal */}
      <ChartPreviewModal
        form={form}
        experimentId={experimentId}
        isOpen={isPreviewOpen}
        onOpenChange={(open) => !open && onPreviewClose()}
      />
    </div>
  );
}
