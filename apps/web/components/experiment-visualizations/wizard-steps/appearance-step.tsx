"use client";

import type { UseFormReturn } from "react-hook-form";

import { zCreateExperimentVisualizationBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  WizardStepButtons,
} from "@repo/ui/components";
import type { WizardStepProps } from "@repo/ui/components";

import {
  LineChartAppearanceConfigurator,
  ScatterChartAppearanceConfigurator,
} from "../chart-configurators/appearance";
import type { ChartFormValues } from "../chart-configurators/chart-configurator-util";
import { ChartPreviewModal } from "../chart-preview/chart-preview-modal";

// Step 4: Chart Appearance and Options
export const appearanceSchema = zCreateExperimentVisualizationBody.pick({
  config: true,
});

// Component to render the appropriate appearance configurator based on chart type
function ChartAppearanceConfigurator({
  chartType,
  form,
}: {
  chartType: "line" | "scatter";
  form: UseFormReturn<ChartFormValues>;
}) {
  const commonProps = {
    form,
  };

  switch (chartType) {
    case "line":
      return <LineChartAppearanceConfigurator {...commonProps} />;
    case "scatter":
      return <ScatterChartAppearanceConfigurator {...commonProps} />;
    default:
      return null;
  }
}

interface AppearanceStepProps extends WizardStepProps<ChartFormValues> {
  isEdit?: boolean;
  experimentId: string;
  isPreviewOpen: boolean;
  onPreviewClose: () => void;
}

export function AppearanceStep({
  form,
  onNext,
  onPrevious,
  stepIndex,
  totalSteps,
  isSubmitting,
  isEdit = false,
  experimentId,
  isPreviewOpen,
  onPreviewClose,
}: AppearanceStepProps) {
  const { t } = useTranslation("experimentVisualizations");
  const { t: tCommon } = useTranslation("common");

  // Get the chart type from the form
  const chartType = form.getValues("chartType") as "line" | "scatter";

  // Determine submit label based on whether we're creating or updating
  const submitLabel = isEdit ? tCommon("common.update") : tCommon("common.create");
  const submittingLabel = isEdit ? tCommon("common.updating") : tCommon("common.creating");

  return (
    <div className="space-y-6">
      {/* Step Header */}
      <Card>
        <CardHeader>
          <CardTitle>{t("wizard.steps.appearance.title")}</CardTitle>
          <CardDescription>{t("wizard.steps.appearance.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Chart Appearance Configurator */}
          <ChartAppearanceConfigurator chartType={chartType} form={form} />
        </CardContent>
      </Card>

      {/* Navigation */}
      <WizardStepButtons
        onNext={onNext}
        onPrevious={onPrevious}
        previousLabel={tCommon("experiments.back")}
        submitLabel={isSubmitting ? submittingLabel : submitLabel}
        isSubmitting={isSubmitting}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
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
