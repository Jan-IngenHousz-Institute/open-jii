"use client";

import * as z from "zod";

import type { CreateExperimentBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { WizardStepButtons } from "@repo/ui/components";
import type { WizardStepProps } from "@repo/ui/components";

import {
  detailsSchema,
  locationsSchema,
  membersVisibilitySchema,
  protocolsSchema,
} from "../form-step";
import { DetailsSection } from "./details-section";
import { LocationsSection } from "./locations-section";
import { MembersVisibilitySection } from "./members-visibility-section";
import { ProtocolsSection } from "./protocols-section";

// For the final review step validate the combined schema of all previous steps
export const reviewSchema = z.object({
  ...detailsSchema.shape,
  ...membersVisibilitySchema.shape,
  ...protocolsSchema.shape,
  ...locationsSchema.shape,
});

export function ReviewStep({
  form,
  onPrevious,
  onNext,
  goToStep,
  stepIndex,
  totalSteps,
  isSubmitting = false,
}: WizardStepProps<CreateExperimentBody>) {
  const formData = form.getValues();
  const { t } = useTranslation();

  return (
    <div className="mx-auto space-y-8">
      {/* Header Section */}
      <div className="space-y-2">
        <h2 className="text-lg font-medium tracking-tight">
          {t("experiments.reviewYourExperiment")}
        </h2>
        <p className="text-muted-foreground text-sm">{t("experiments.reviewAllDetails")}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Details - full width */}
        <DetailsSection className="md:col-span-2" formData={formData} onEdit={() => goToStep(0)} />

        {/* Members - full width */}
        <MembersVisibilitySection
          className="md:col-span-2"
          formData={formData}
          onEdit={() => goToStep(1)}
        />

        {/* Protocols (left) */}
        <ProtocolsSection formData={formData} onEdit={() => goToStep(2)} />

        {/* Locations (right) */}
        <LocationsSection formData={formData} onEdit={() => goToStep(3)} />
      </div>

      <WizardStepButtons
        onPrevious={onPrevious}
        onNext={onNext}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        isSubmitting={isSubmitting}
        previousLabel={t("experiments.back")}
        submitLabel={t("experiments.createExperiment")}
      />
    </div>
  );
}
