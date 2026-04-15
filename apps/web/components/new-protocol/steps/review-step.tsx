"use client";

import { getSensorFamilyLabel } from "@/util/sensor-family";
import * as z from "zod";

import type { CreateProtocolRequestBody, Macro } from "@repo/api";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { RichTextRenderer } from "@repo/ui/components/rich-text-renderer";
import { WizardStepButtons } from "@repo/ui/components/wizard-form";
import type { WizardStepProps } from "@repo/ui/components/wizard-form";
import { codeSchema } from "./code-test-step";
import { detailsSchema } from "./details-step";

// Combine all previous step schemas for validation
export const reviewSchema = z.object({
  ...detailsSchema.shape,
  ...codeSchema.shape,
});

interface ReviewStepProps extends WizardStepProps<CreateProtocolRequestBody> {
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
        {/* Left column — Details + Macros (defines the row height) */}
        <div className="flex w-full flex-col gap-6 md:w-1/2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold">
                {t("newProtocol.detailsTitle")}
              </CardTitle>
              <Button type="button" onClick={() => goToStep(0)} variant="link" size="sm">
                {t("common.edit")}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                    {t("newProtocol.protocolName")}
                  </div>
                  <div className="mt-1 text-base font-medium">{formData.name || "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                    {t("newProtocol.sensorFamily")}
                  </div>
                  <div className="mt-1 text-base font-medium">
                    {getSensorFamilyLabel(formData.family)}
                  </div>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold">
                {t("newProtocol.compatibleMacros")}
              </CardTitle>
              <Button type="button" onClick={() => goToStep(0)} variant="link" size="sm">
                {t("common.edit")}
              </Button>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </div>

        {/* Right column — Code (absolutely positioned, height matches left column) */}
        <div className="relative md:absolute md:bottom-0 md:right-0 md:top-0 md:w-[calc(50%-0.75rem)]">
          <Card className="flex h-full flex-col">
            <CardHeader className="flex shrink-0 flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold">
                {t("newProtocol.protocolCode")}
              </CardTitle>
              <Button type="button" onClick={() => goToStep(1)} variant="link" size="sm">
                {t("common.edit")}
              </Button>
            </CardHeader>
            <CardContent className="min-h-0 flex-1">
              <div className="bg-muted/30 h-full overflow-auto rounded-md border p-3">
                <pre className="text-xs">
                  <code>{JSON.stringify(formData.code, null, 2)}</code>
                </pre>
              </div>
            </CardContent>
          </Card>
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
