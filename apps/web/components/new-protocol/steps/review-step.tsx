"use client";

import { InsetPanel } from "@/components/shared/inset-panel";
import { SettingsCard } from "@/components/shared/settings-card";
import { useJsonFormatStyle } from "@/hooks/useJsonFormatStyle";
import { formatJson } from "@/lib/json-format";
import { getSensorFamilyLabel } from "@/util/sensor-family";
import * as z from "zod";

import type { Macro } from "@repo/api/domains/macro/macro.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { RichTextRenderer } from "@repo/ui/components/rich-text-renderer";
import { WizardStepButtons } from "@repo/ui/components/wizard-form";
import type { WizardStepProps } from "@repo/ui/components/wizard-form";

import { useOwningOrganizationLabel } from "../../organizations/use-owning-organization-label";
import type { NewProtocolFormValues } from "../new-protocol-form-values";
import { codeSchema } from "./code-test-step";
import { detailsSchema } from "./details-step";

// Combine all previous step schemas for validation
export const reviewSchema = z.object({
  ...detailsSchema.shape,
  ...codeSchema.shape,
});

interface ReviewStepProps extends WizardStepProps<NewProtocolFormValues> {
  selectedMacros: Macro[];
}

export function ReviewStep({
  form,
  onPrevious,
  onNext,
  goToStep,
  stepIndex,
  totalSteps,
  isSubmitting = false,
  selectedMacros,
}: ReviewStepProps) {
  const formData = form.getValues();
  const { t } = useTranslation();
  const organizationLabel = useOwningOrganizationLabel(formData.organizationId);
  // Read-only preview inside the wizard, so it follows the stored preference
  // without its own control; the toggle lives on the editors this step reviews.
  const { style } = useJsonFormatStyle();

  return (
    <div className="mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-lg font-medium tracking-tight">
          {t("newProtocol.reviewYourProtocol")}
        </h2>
        <p className="text-muted-foreground text-sm">{t("newProtocol.reviewAllDetails")}</p>
      </div>

      <div className="relative flex flex-col gap-6 md:flex-row">
        {/* Left column: Details + Macros (defines the row height) */}
        <div className="flex w-full flex-col gap-6 md:w-1/2">
          <SettingsCard
            title={t("newProtocol.detailsTitle")}
            action={
              <Button type="button" onClick={() => goToStep(0)} variant="link" size="sm">
                {t("common.edit")}
              </Button>
            }
            contentClassName="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                  {t("newProtocol.protocolName")}
                </div>
                <div className="mt-1 text-base font-medium">{formData.name || "\u2014"}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                  {t("newProtocol.sensorFamily")}
                </div>
                <div className="mt-1 text-base font-medium">
                  {getSensorFamilyLabel(formData.family)}
                </div>
              </div>
              {/* Who will own it: never blank, since leaving the picker alone
                    still means the personal workspace. */}
              <div>
                <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                  {t("organizations.picker.label")}
                </div>
                <div className="mt-1 text-base font-medium">{organizationLabel ?? "..."}</div>
              </div>
            </div>

            {formData.description ? (
              <div>
                <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
                  {t("newProtocol.description_field")}
                </div>
                <div className="rounded-md border p-3 text-sm">
                  <RichTextRenderer content={formData.description} />
                </div>
              </div>
            ) : (
              <div>
                <div className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wider">
                  {t("newProtocol.description_field")}
                </div>
                <div className="text-muted-foreground text-sm">
                  {t("newProtocol.noDescription")}
                </div>
              </div>
            )}
          </SettingsCard>

          <SettingsCard
            title={t("newProtocol.compatibleMacros")}
            action={
              <Button type="button" onClick={() => goToStep(0)} variant="link" size="sm">
                {t("common.edit")}
              </Button>
            }
          >
            {selectedMacros.length > 0 ? (
              <div className="space-y-2">
                {selectedMacros.map((macro) => (
                  <div
                    key={macro.id}
                    className="flex items-center gap-2 rounded-md border px-3 py-2"
                  >
                    <span className="truncate text-sm font-medium">{macro.name}</span>
                    <span className="text-muted-foreground text-xs">{macro.language}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{t("newProtocol.noMacrosAdded")}</p>
            )}
          </SettingsCard>
        </div>

        {/* Right column: Code (absolutely positioned, height matches left column) */}
        <div className="relative md:absolute md:bottom-0 md:right-0 md:top-0 md:w-[calc(50%-0.75rem)]">
          <SettingsCard
            title={t("newProtocol.protocolCode")}
            action={
              <Button type="button" onClick={() => goToStep(1)} variant="link" size="sm">
                {t("common.edit")}
              </Button>
            }
            className="flex h-full flex-col"
            contentClassName="min-h-0 flex-1"
          >
            <InsetPanel className="h-full overflow-auto">
              <pre className="whitespace-pre-wrap break-words text-xs">
                <code>{formatJson(formData.code, { style })}</code>
              </pre>
            </InsetPanel>
          </SettingsCard>
        </div>
      </div>

      <WizardStepButtons
        onPrevious={onPrevious}
        onNext={onNext}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        isSubmitting={isSubmitting}
        previousLabel={t("experiments.back")}
        submitLabel={t("newProtocol.finalizeSetup")}
      />
    </div>
  );
}
