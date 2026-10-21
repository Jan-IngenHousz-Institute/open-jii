"use client";

import { FollowedStandardsCheck } from "@/components/experiment-standards/followed-standards-check";
import { useFollowedStandards } from "@/components/experiment-standards/use-followed-standards";
import { useDatasetPlotChecks } from "@/hooks/dataset/useDatasetPlotChecks/useDatasetPlotChecks";
import { useDatasetReadiness } from "@/hooks/dataset/useDatasetReadiness/useDatasetReadiness";
import { useLocalDateFormat } from "@/hooks/useLocalDateFormat";
import { useLocale } from "@/hooks/useLocale";
import { useEffect } from "react";

import type { OpenAireFloorField } from "@repo/api/domains/dataset/dataset.schema";
import type { FundingReference } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Skeleton } from "@repo/ui/components/skeleton";
import type { WizardStepProps } from "@repo/ui/components/wizard-form";

import { LICENSE_KEYS } from "../license-keys";
import type { PublishDatasetForm } from "./dataset-publish-schema";
import { DatasetPublishStepFrame } from "./dataset-publish-step-frame";
import { FreezeHoldRow } from "./freeze-hold-row";
import { OpenAireFloorRow } from "./openaire-floor-row";
import { StepLoadError } from "./step-load-error";

// Where in the flow each field a researcher fills is set; the rest the platform fills itself.
const FIXED_IN: Partial<
  Record<OpenAireFloorField, { step: "describe" | "license"; index: number }>
> = {
  title: { step: "describe", index: 2 },
  creators: { step: "describe", index: 2 },
  license: { step: "license", index: 3 },
  access: { step: "license", index: 3 },
};

const CURATE_INDEX = 1;

interface CheckStepProps extends WizardStepProps<PublishDatasetForm> {
  datasetId: string;
  experimentId: string;
  funding: FundingReference[];
  /** Whether the standards the experiment follows exist yet; before that only this flow holds Freeze. */
  showsStandards: boolean;
}

export function CheckStep({
  datasetId,
  experimentId,
  funding,
  showsStandards,
  ...props
}: CheckStepProps) {
  const { t } = useTranslation("datasets");
  const locale = useLocale();
  const format = useLocalDateFormat(locale);
  const { form, goToStep } = props;
  const readiness = useDatasetReadiness(datasetId);
  const plotChecks = useDatasetPlotChecks(datasetId);
  const { followed } = useFollowedStandards(experimentId);

  const isFloorComplete = readiness.data?.floor.missing.length === 0;
  const measuredTwice = plotChecks.data?.measuredTwice.length ?? 0;
  // The standards' steps include plots measured twice, so they replace this flow's own hold.
  const isHeldElsewhere = showsStandards
    ? followed === undefined || followed.holding > 0
    : plotChecks.data === undefined || measuredTwice > 0;
  const canFreeze = isFloorComplete && !isHeldElsewhere;
  const showsOwnHold = !showsStandards && measuredTwice > 0;
  const isBlocked = form.formState.errors.floorComplete !== undefined;

  // The step's validation is what stops Next, so the verdict is mirrored into the form.
  useEffect(() => {
    if (canFreeze) {
      form.setValue("floorComplete", true, { shouldValidate: true });
    } else {
      form.resetField("floorComplete");
    }
  }, [form, canFreeze]);

  const handleRetry = () => {
    void readiness.refetch();
    void plotChecks.refetch();
  };

  if (readiness.isError || plotChecks.isError) {
    return (
      <DatasetPublishStepFrame {...props}>
        <StepLoadError
          message={t("publish.loadError")}
          retryLabel={t("publish.retry")}
          onRetry={handleRetry}
        />
      </DatasetPublishStepFrame>
    );
  }

  if (readiness.data === undefined || plotChecks.data === undefined) {
    return <Skeleton className="h-96 w-full" />;
  }

  const [title, authors, license, access, embargoUntil] = form.getValues([
    "title",
    "authors",
    "license",
    "access",
    "embargoUntil",
  ]);
  const accessValue =
    access === "embargoed" && embargoUntil !== undefined
      ? t("check.values.embargoed", { date: format.date(embargoUntil) })
      : t("check.values.open");

  const values: Partial<Record<OpenAireFloorField, string>> = {
    title,
    creators: t("check.values.creators", { count: authors.length }),
    publisher: t("check.values.publisher"),
    year: String(new Date().getFullYear()),
    type: t("check.values.type"),
    license: t(`licenses.${LICENSE_KEYS[license]}`),
    access: accessValue,
    funding: funding.map((reference) => reference.funderName).join(", "),
  };

  const fixFor = (field: OpenAireFloorField) => {
    const place = FIXED_IN[field];
    if (place === undefined) {
      return null;
    }
    return {
      label: t("check.fillIn", { step: t(`publish.steps.${place.step}`) }),
      go: () => goToStep(place.index),
    };
  };

  const openCurate = () => goToStep(CURATE_INDEX);

  return (
    <DatasetPublishStepFrame {...props}>
      <div className="space-y-4" data-testid="dataset-check">
        <OpenAireFloorRow floor={readiness.data.floor} values={values} onFix={fixFor} />

        {showsStandards ? (
          <FollowedStandardsCheck experimentId={experimentId} isBlocked={isBlocked} />
        ) : null}

        {showsOwnHold ? (
          <ul className="space-y-2" data-testid="freeze-holds">
            <FreezeHoldRow
              title={t("check.holdsMeasuredTwice", { count: measuredTwice })}
              actionLabel={t("check.openCurate")}
              onAction={openCurate}
              isBlocked={isBlocked}
            />
          </ul>
        ) : null}

        {isBlocked && !showsStandards ? (
          <p className="text-destructive text-sm">{t("check.blocked")}</p>
        ) : null}
      </div>
    </DatasetPublishStepFrame>
  );
}
