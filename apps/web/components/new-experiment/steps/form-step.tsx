"use client";

import type { ComponentType } from "react";
import type { UseFormReturn } from "react-hook-form";
import { z } from "zod";

import { validateEmbargoDate, zCreateExperimentBodyBase } from "@repo/api";
import type { CreateExperimentBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { WizardStepButtons } from "@repo/ui/components";
import type { WizardStepProps } from "@repo/ui/components";

export const detailsSchema = zCreateExperimentBodyBase.pick({ name: true, description: true });

const membersVisibilityBase = zCreateExperimentBodyBase.pick({
  members: true,
  visibility: true,
  embargoUntil: true,
});

const shape = membersVisibilityBase.shape;

export const membersVisibilitySchema = z.object({
  ...shape,
  embargoUntil: shape.embargoUntil.refine(
    (value) => {
      // Create a dummy refinement context and capture whether issues were added
      let hasIssue = false;
      validateEmbargoDate(
        value,
        {
          addIssue: () => {
            hasIssue = true;
          },
        } as unknown as z.RefinementCtx,
        ["embargoUntil"],
      );
      return !hasIssue;
    },
    {
      message: "Embargo end date must be between tomorrow and 365 days from now",
    },
  ),
});

export const protocolsSchema = zCreateExperimentBodyBase.pick({ protocols: true });

export const locationsSchema = zCreateExperimentBodyBase.pick({ locations: true });

interface CardComponent {
  form: UseFormReturn<CreateExperimentBody>;
}

interface FormStepProps extends WizardStepProps<CreateExperimentBody> {
  cards: ComponentType<CardComponent>[];
}

export function FormStep({
  form,
  onPrevious,
  onNext,
  stepIndex,
  totalSteps,
  isSubmitting = false,
  cards,
}: FormStepProps) {
  const { t } = useTranslation();

  // Use grid layout when there are 2 cards (for members + visibility)
  const useGrid = cards.length === 2;

  return (
    <div className="space-y-6">
      <div className={useGrid ? "grid gap-6 md:grid-cols-2" : "space-y-6"}>
        {cards.map((Card, index) => (
          <Card key={index} form={form} />
        ))}
      </div>
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
