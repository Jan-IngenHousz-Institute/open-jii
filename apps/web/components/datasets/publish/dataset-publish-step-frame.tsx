"use client";

import type { ReactNode } from "react";

import { useTranslation } from "@repo/i18n";
import { WizardStepButtons } from "@repo/ui/components/wizard-form";
import type { WizardStepProps } from "@repo/ui/components/wizard-form";

import type { PublishDatasetForm } from "./dataset-publish-schema";

interface DatasetPublishStepFrameProps extends WizardStepProps<PublishDatasetForm> {
  children: ReactNode;
}

/** A step's cards above the shared Back and Next row, as the new experiment form lays them out. */
export function DatasetPublishStepFrame({
  children,
  onPrevious,
  onNext,
  stepIndex,
  totalSteps,
  isSubmitting = false,
}: DatasetPublishStepFrameProps) {
  const { t } = useTranslation("datasets");

  return (
    <div className="space-y-6">
      <div className="space-y-6">{children}</div>
      <WizardStepButtons
        onPrevious={onPrevious}
        onNext={onNext}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        isSubmitting={isSubmitting}
        nextLabel={t("publish.next")}
        previousLabel={t("publish.back")}
        submitLabel={t("freeze.submit")}
      />
    </div>
  );
}
