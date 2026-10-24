"use client";

import { formatShortDate } from "@/util/date";
import { useState } from "react";

import type { Experiment, FundingReference } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import { ExperimentStudyDetailsDialog } from "./experiment-study-details-dialog";
import { useDataLicenseLabel } from "./use-data-license-label";

interface ExperimentStudyDetailsSectionProps {
  experimentId: string;
  experiment: Experiment;
  hasAccess?: boolean;
  isArchived?: boolean;
}

export function ExperimentStudyDetailsSection({
  experimentId,
  experiment,
  hasAccess = false,
  isArchived = false,
}: ExperimentStudyDetailsSectionProps) {
  const { t } = useTranslation("experiments");
  const licenseLabel = useDataLicenseLabel();
  const { t: tStudy } = useTranslation("studyMetadata");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const canEdit = hasAccess && !isArchived;
  const hasPeriod = Boolean(experiment.startDate ?? experiment.endDate);
  const notSet = t("studyDetails.dateNotSet");
  // Plain dates are formatted in UTC, or a reader west of Greenwich would see the day before.
  const formatDay = (day: string | null) => (day ? formatShortDate(day, "en-US", "UTC") : notSet);
  const period = hasPeriod
    ? `${formatDay(experiment.startDate)} → ${formatDay(experiment.endDate)}`
    : null;
  const fundingReferences = experiment.fundingReferences ?? [];
  const hasFunding = fundingReferences.length > 0;
  const hasAnyDetail =
    hasPeriod ||
    hasFunding ||
    Boolean(experiment.organism) ||
    Boolean(experiment.growthFacility) ||
    Boolean(experiment.experimentalDesign) ||
    Boolean(experiment.license);
  const showsRows = canEdit || hasAnyDetail;

  const renderValue = (value: string | null) =>
    value === null ? (
      <p className="text-muted-foreground text-sm italic">{t("studyDetails.notSet")}</p>
    ) : (
      <p className="line-clamp-3 text-sm" title={value}>
        {value}
      </p>
    );

  // Someone who may edit sees every field, so they know what is still missing.
  const renderRow = (label: string, value: string | null | undefined) => {
    const text = value === "" ? null : (value ?? null);
    const isHidden = text === null && !canEdit;

    return isHidden ? null : (
      <div>
        <p className="text-muted-foreground text-xs">{label}</p>
        {renderValue(text)}
      </div>
    );
  };

  const renderFundingReference = (reference: FundingReference, index: number) => {
    const text = reference.awardNumber
      ? tStudy("funding.reference", { funder: reference.funderName, award: reference.awardNumber })
      : reference.funderName;
    return <div key={index}>{renderValue(text)}</div>;
  };

  const renderFunding = () => {
    if (!hasFunding && !canEdit) {
      return null;
    }
    return (
      <div data-study-funding>
        <p className="text-muted-foreground text-xs">{tStudy("funding.title")}</p>
        {hasFunding ? fundingReferences.map(renderFundingReference) : renderValue(null)}
      </div>
    );
  };

  return (
    <>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">{t("studyDetails.title")}</h4>
          {canEdit ? (
            <Button variant="link" className="h-auto p-0" onClick={() => setIsDialogOpen(true)}>
              {t("common.edit")}
            </Button>
          ) : null}
        </div>

        {showsRows ? (
          <div className="space-y-2">
            {renderRow(t("studyDetails.period"), period)}
            {renderRow(t("studyDetails.organism"), experiment.organism)}
            {renderRow(t("studyDetails.experimentalDesign"), experiment.experimentalDesign)}
            {renderRow(t("studyDetails.growthFacility"), experiment.growthFacility)}
            {renderRow(
              t("studyDetails.license"),
              experiment.license ? licenseLabel(experiment.license) : null,
            )}
            {renderFunding()}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm italic">{t("studyDetails.empty")}</p>
        )}
      </div>

      <ExperimentStudyDetailsDialog
        experimentId={experimentId}
        experiment={experiment}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </>
  );
}
