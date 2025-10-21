"use client";

import { zCreateExperimentBodyBase } from "@repo/api";
import type { CreateExperimentBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { WizardStepButtons } from "@repo/ui/components";
import type { WizardStepProps } from "@repo/ui/components";

import { NewExperimentDetailsCard } from "../new-experiment-details-card";

export const detailsSchema = zCreateExperimentBodyBase.pick({ name: true, description: true });

export function DetailsStep({
  form,
  onPrevious,
  onNext,
  stepIndex,
  totalSteps,
  isSubmitting = false,
}: WizardStepProps<CreateExperimentBody>) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <NewExperimentDetailsCard form={form} />
      <WizardStepButtons
        onPrevious={onPrevious}
        onNext={onNext}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        isSubmitting={isSubmitting}
        nextLabel={t("experiments.next")}
        previousLabel={t("experiments.back")}
      />
    </div>
  );
}
