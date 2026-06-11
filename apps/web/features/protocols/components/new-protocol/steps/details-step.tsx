"use client";

import type { ComponentType } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { CreateProtocolRequestBody } from "@repo/api/schemas/protocol.schema";
import { zCreateProtocolRequestBody } from "@repo/api/schemas/protocol.schema";
import { useTranslation } from "@repo/i18n";
import { WizardStepButtons } from "@repo/ui/components/wizard-form";
import type { WizardStepProps } from "@repo/ui/components/wizard-form";

// Validation schema for step 1 — details only (no code)
export const detailsSchema = zCreateProtocolRequestBody.pick({
  name: true,
  description: true,
  family: true,
});

interface DetailsCardProps {
  form: UseFormReturn<CreateProtocolRequestBody>;
}

interface DetailsStepProps extends WizardStepProps<CreateProtocolRequestBody> {
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
