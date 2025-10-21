"use client";

import { zCreateExperimentBodyBase } from "@repo/api";
import type { CreateExperimentBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { WizardStepButtons } from "@repo/ui/components";
import type { WizardStepProps } from "@repo/ui/components";

import { NewExperimentLocationsCard } from "../new-experiment-locations-card";

export const locationsSchema = zCreateExperimentBodyBase.pick({ locations: true });

export function LocationsStep({
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
      <NewExperimentLocationsCard form={form} />
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
