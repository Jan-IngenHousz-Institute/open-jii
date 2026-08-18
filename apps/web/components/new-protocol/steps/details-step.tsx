"use client";

import type { ComponentType } from "react";
import type { UseFormReturn } from "react-hook-form";

import { zCreateProtocolRequestBody } from "@repo/api/domains/protocol/protocol.schema";
import { useTranslation } from "@repo/i18n";
import { WizardStepButtons } from "@repo/ui/components/wizard-form";
import type { WizardStepProps } from "@repo/ui/components/wizard-form";

import type { NewProtocolFormValues } from "../new-protocol-form-values";

// Validation schema for step 1 — details only (no code)
export const detailsSchema = zCreateProtocolRequestBody.pick({
  name: true,
  description: true,
  family: true,
  visibility: true,
});

interface DetailsCardProps {
  form: UseFormReturn<NewProtocolFormValues>;
}

interface DetailsStepProps extends WizardStepProps<NewProtocolFormValues> {
  cards: ComponentType<DetailsCardProps>[];
}

export function DetailsStep({
  form,
  onPrevious,
  onNext,
  stepIndex,
  totalSteps,
  isSubmitting = false,
  cards,
}: DetailsStepProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {cards.map((Card, index) => (
        <Card key={index} form={form} />
      ))}
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
