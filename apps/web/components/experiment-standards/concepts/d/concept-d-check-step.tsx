"use client";

import type { PublishDatasetForm } from "@/components/datasets/publish/dataset-publish-schema";
import { DatasetPublishStepFrame } from "@/components/datasets/publish/dataset-publish-step-frame";
import { OpenAireFloorRow } from "@/components/datasets/publish/openaire-floor-row";
import { useDatasetReadiness } from "@/hooks/dataset/useDatasetReadiness/useDatasetReadiness";
import { useEffect } from "react";

import { useTranslation } from "@repo/i18n";
import { Skeleton } from "@repo/ui/components/skeleton";
import type { WizardStepProps } from "@repo/ui/components/wizard-form";

import { FollowedStandardsCheck } from "./followed-standards-check";
import { useFollowedReadiness } from "./use-followed-readiness";
import { useFollowedStandards } from "./use-followed-standards";

interface ConceptDCheckStepProps extends WizardStepProps<PublishDatasetForm> {
  datasetId: string;
  experimentId: string;
}

/** Check under Concept D: the floor and every standard the trial follows hold the freeze. */
export function ConceptDCheckStep({ datasetId, experimentId, ...props }: ConceptDCheckStepProps) {
  const { t } = useTranslation("datasets");
  const { form } = props;
  const { data: datasetReadiness, isLoading } = useDatasetReadiness(datasetId);
  const { followed, setFollowed } = useFollowedStandards();
  const followedReadiness = useFollowedReadiness(experimentId, followed);

  const isFloorComplete = datasetReadiness?.floor.missing.length === 0;
  const hasStepsLeft =
    followedReadiness === undefined || followedReadiness.stepsBeforePublishing.length > 0;
  const canFreeze = isFloorComplete && !hasStepsLeft;
  const isBlocked = form.formState.errors.floorComplete !== undefined;

  // Check's one gate field, which here also waits on the followed standards.
  useEffect(() => {
    if (canFreeze) {
      form.setValue("floorComplete", true, { shouldValidate: true });
    } else {
      form.resetField("floorComplete");
    }
  }, [form, canFreeze]);

  if (isLoading || datasetReadiness === undefined || followedReadiness === undefined) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <DatasetPublishStepFrame {...props}>
      <div className="space-y-4" data-testid="dataset-check">
        <OpenAireFloorRow floor={datasetReadiness.floor} />
        {isBlocked && !isFloorComplete ? (
          <p className="text-destructive text-sm">{t("check.floorBlocked")}</p>
        ) : null}

        <FollowedStandardsCheck
          experimentId={experimentId}
          readiness={followedReadiness}
          followed={followed}
          onFollowedChange={setFollowed}
          isBlocked={isBlocked && hasStepsLeft}
        />
      </div>
    </DatasetPublishStepFrame>
  );
}
