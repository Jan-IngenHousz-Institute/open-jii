"use client";

import { zCreateExperimentVisualizationBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { WizardStepButtons } from "@repo/ui/components/wizard-form";
import type { WizardStepProps } from "@repo/ui/components/wizard-form";
import type { ChartFormValues } from "../chart-configurators/chart-configurator-util";
import { ChartPreviewModal } from "../chart-preview/chart-preview-modal";

// Step 1: Basic Information
export const basicInfoSchema = zCreateExperimentVisualizationBody.pick({
  name: true,
  description: true,
});

interface BasicInfoStepProps extends WizardStepProps<ChartFormValues> {
  experimentId: string;
  isPreviewOpen: boolean;
  onPreviewClose: () => void;
}

export function BasicInfoStep({
  form,
  onNext,
  onPrevious,
  stepIndex,
  totalSteps,
  isSubmitting,
  experimentId,
  isPreviewOpen,
  onPreviewClose,
}: BasicInfoStepProps) {
  const { t } = useTranslation("experimentVisualizations");
  const { t: tCommon } = useTranslation("common");

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("form.details.title")}</CardTitle>
          <CardDescription>{t("form.details.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("form.details.name")}</FormLabel>
                <FormControl>
                  <Input placeholder={t("form.details.namePlaceholder")} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("form.details.description")}</FormLabel>
                <FormControl>
                  <Textarea placeholder={t("form.details.descriptionPlaceholder")} {...field} />
                </FormControl>
                <FormDescription>{t("form.details.descriptionHelp")}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
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
        submitLabel={tCommon("common.create")}
      />

      {/* Chart Preview Modal */}
      <ChartPreviewModal
        form={form}
        experimentId={experimentId}
        isOpen={isPreviewOpen}
        onOpenChange={(open) => !open && onPreviewClose()}
      />
    </>
  );
}
