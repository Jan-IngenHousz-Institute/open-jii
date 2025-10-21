"use client";

import * as z from "zod";

import type { CreateExperimentBody } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { WizardStepButtons } from "@repo/ui/components";
import type { WizardStepProps } from "@repo/ui/components";

import { detailsSchema } from "../details-step";
import { locationsSchema } from "../locations-step";
import { membersVisibilitySchema } from "../members-visibility-step";
import { protocolsSchema } from "../protocols-step";
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

      <div className="grid gap-6">
        {/* Details */}
        <DetailsSection
          formData={formData}
          onEdit={() => (goToStep as (index: number) => void)(0)}
        />

        {/* Members & Visibility */}
        <MembersVisibilitySection
          formData={formData}
          onEdit={() => (goToStep as (index: number) => void)(1)}
        />

        {/* Protocols & Locations Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          <ProtocolsSection
            formData={formData}
            onEdit={() => (goToStep as (index: number) => void)(2)}
          />

          <LocationsSection
            formData={formData}
            onEdit={() => (goToStep as (index: number) => void)(3)}
          />
        </div>
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
