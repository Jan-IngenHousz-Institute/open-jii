"use client";

import { Globe, Lock } from "lucide-react";
import { z } from "zod";

import { useTranslation } from "@repo/i18n";
import { WizardStepButtons } from "@repo/ui/components/wizard-form";
import type { WizardStepProps } from "@repo/ui/components/wizard-form";

import type { NewOrganizationFormValues } from "../form-step";
import { identitySchema, peopleSchema, profileSchema } from "../form-step";
import { IdentitySection } from "./identity-section";
import { PeopleSection } from "./people-section";
import { ProfileSection } from "./profile-section";

/**
 * The last step validates every earlier step's fields, so nothing reaches the create
 * because the step that owns it was never visited. It takes the identity schema's two
 * arguments for the same reason that schema does.
 */
export function reviewSchema(
  t: (key: string) => string,
  isSlugTaken: (slug: string) => boolean,
): z.AnyZodObject {
  return z.object({
    ...identitySchema(t, isSlugTaken).shape,
    ...profileSchema(t).shape,
    ...peopleSchema.shape,
  });
}

export function ReviewStep({
  form,
  onPrevious,
  onNext,
  goToStep,
  stepIndex,
  totalSteps,
  isSubmitting = false,
}: WizardStepProps<NewOrganizationFormValues>) {
  const { t } = useTranslation();
  const formData = form.getValues();
  const isPublic = formData.visibility === "public";

  return (
    <div className="mx-auto space-y-8">
      <div className="space-y-2">
        <h2 className="text-lg font-medium tracking-tight">
          {t("organizations.create.reviewHeading")}
        </h2>
        <p className="text-muted-foreground text-sm">{t("organizations.create.reviewHint")}</p>
      </div>

      {/* `min-w-0`: a grid item does not shrink below its content, so an unbreakable value would widen the column. */}
      <div className="grid gap-6 md:grid-cols-2">
        <IdentitySection
          className="min-w-0 md:col-span-2"
          formData={formData}
          onEdit={() => goToStep(0)}
        />
        <ProfileSection className="min-w-0" formData={formData} onEdit={() => goToStep(1)} />
        <PeopleSection className="min-w-0" formData={formData} onEdit={() => goToStep(2)} />
      </div>

      {/* Two literal keys rather than one interpolated: only literals are guarded. */}
      <p className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed">
        {isPublic ? (
          <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        ) : (
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        )}
        {isPublic ? t("organizations.create.publicNote") : t("organizations.create.privateNote")}
      </p>

      <WizardStepButtons
        onPrevious={onPrevious}
        onNext={onNext}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        isSubmitting={isSubmitting}
        previousLabel={t("common.back")}
        submitLabel={
          isSubmitting ? t("organizations.create.creating") : t("organizations.createAction")
        }
      />
    </div>
  );
}
