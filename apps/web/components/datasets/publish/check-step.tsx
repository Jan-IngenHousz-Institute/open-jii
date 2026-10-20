"use client";

import { SettingsCard } from "@/components/shared/settings-card";
import { useDatasetReadiness } from "@/hooks/dataset/useDatasetReadiness/useDatasetReadiness";
import { useEffect } from "react";

import type { StandardReadiness } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { Skeleton } from "@repo/ui/components/skeleton";
import type { WizardStepProps } from "@repo/ui/components/wizard-form";

import type { PublishDatasetForm } from "./dataset-publish-schema";
import { DatasetPublishStepFrame } from "./dataset-publish-step-frame";
import { OpenAireFloorRow } from "./openaire-floor-row";
import { StandardCheckRow } from "./standard-check-row";

interface CheckStepProps extends WizardStepProps<PublishDatasetForm> {
  datasetId: string;
}

export function CheckStep({ datasetId, ...props }: CheckStepProps) {
  const { t } = useTranslation("datasets");
  const { form } = props;
  const { data: readiness, isLoading } = useDatasetReadiness(datasetId);
  const isFloorComplete = readiness?.floor.missing.length === 0;
  const isBlocked = form.formState.errors.floorComplete !== undefined;

  // The step's validation is what stops Next, so the server's verdict is mirrored into the form.
  useEffect(() => {
    if (isFloorComplete) {
      form.setValue("floorComplete", true, { shouldValidate: true });
    } else {
      form.resetField("floorComplete");
    }
  }, [form, isFloorComplete]);

  if (isLoading || readiness === undefined) {
    return <Skeleton className="h-96 w-full" />;
  }

  const renderStandard = (standard: StandardReadiness) => (
    <StandardCheckRow key={standard.standard} readiness={standard} />
  );

  return (
    <DatasetPublishStepFrame {...props}>
      <div className="space-y-4" data-testid="dataset-check">
        <OpenAireFloorRow floor={readiness.floor} />
        {isBlocked ? <p className="text-destructive text-sm">{t("check.floorBlocked")}</p> : null}

        <SettingsCard
          title={t("check.standardsTitle")}
          description={t("check.standardsDescription")}
        >
          <ul className="divide-border divide-y">{readiness.standards.map(renderStandard)}</ul>
        </SettingsCard>
      </div>
    </DatasetPublishStepFrame>
  );
}
