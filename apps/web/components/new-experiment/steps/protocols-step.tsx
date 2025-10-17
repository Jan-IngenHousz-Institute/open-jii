"use client";

import type { CreateExperimentBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { WizardStepButtons } from "@repo/ui/components";
import type { WizardStepProps } from "@repo/ui/components";

import { NewExperimentProtocolsCard } from "../new-experiment-protocols-card";

export function ProtocolsStep({
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
      <NewExperimentProtocolsCard form={form} />
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
