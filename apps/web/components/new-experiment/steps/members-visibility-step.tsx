"use client";

import * as z from "zod";

import { zCreateExperimentBodyBase, validateEmbargoDate } from "@repo/api";
import type { CreateExperimentBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { WizardStepButtons } from "@repo/ui/components";
import type { WizardStepProps } from "@repo/ui/components";

import { NewExperimentMembersCard } from "../new-experiment-members-card";
import { NewExperimentVisibilityCard } from "../new-experiment-visibility-card";

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

export function MembersVisibilityStep({
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
      <div className="flex flex-col gap-6 md:flex-row">
        <NewExperimentMembersCard form={form} />
        <NewExperimentVisibilityCard form={form} />
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
