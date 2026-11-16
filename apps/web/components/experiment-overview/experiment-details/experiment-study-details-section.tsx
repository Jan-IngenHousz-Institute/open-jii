"use client";

import { useExperimentStudyRecord } from "@/hooks/experiment/useExperimentStudyRecord/useExperimentStudyRecord";
import { formatShortDate } from "@/util/date";
import { useState } from "react";

import type { Experiment, FundingReference } from "@repo/api/domains/experiment/experiment.schema";
import type {
  RelatedWork,
  StudySubject,
} from "@repo/api/domains/experiment/study/experiment-study.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import { ExperimentStudyDetailsDialog } from "./experiment-study-details-dialog";
import { studySubjects } from "./study-details-form-schema";
import { useDataLicenseLabel } from "./use-data-license-label";
import { useFunderIdentifierTypeLabel } from "./use-funder-identifier-type-label";
import { useRelationLabel } from "./use-relation-label";

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
  const relationLabel = useRelationLabel();
  const identifierTypeLabel = useFunderIdentifierTypeLabel();
  const { t: tStudy } = useTranslation("studyMetadata");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { data: record } = useExperimentStudyRecord(experimentId);

  const canEdit = hasAccess && !isArchived;
  const hasPeriod = Boolean(experiment.startDate ?? experiment.endDate);
  const notSet = t("studyDetails.dateNotSet");
  // Plain dates are formatted in UTC, or a reader west of Greenwich would see the day before.
  const formatDay = (day: string | null) => (day ? formatShortDate(day, "en-US", "UTC") : notSet);
  const period = hasPeriod
    ? `${formatDay(experiment.startDate)} → ${formatDay(experiment.endDate)}`
    : null;
  const fundingReferences = experiment.fundingReferences ?? [];
  const subjects = studySubjects(experiment, record);
  const relatedWork = record?.relatedWork ?? [];
  const hasFunding = fundingReferences.length > 0;
  const hasSubjects = subjects.length > 0;
  const hasRelatedWork = relatedWork.length > 0;
  const hasAnyDetail =
    hasPeriod ||
    hasFunding ||
    hasSubjects ||
    hasRelatedWork ||
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

  const renderList = (label: string, hasItems: boolean, items: React.ReactNode) => {
    const isHidden = !hasItems && !canEdit;

    return isHidden ? null : (
      <div>
        <p className="text-muted-foreground text-xs">{label}</p>
        {hasItems ? items : renderValue(null)}
      </div>
    );
  };

  const renderSubject = (subject: StudySubject, index: number) => (
    <p key={index} className="text-sm">
      {subject.label}
      {subject.term && (
        <span className="text-muted-foreground ml-2 font-mono text-xs">{subject.term.id}</span>
      )}
    </p>
  );

  const renderRelatedWork = (work: RelatedWork, index: number) => (
    <p key={index} className="text-sm">
      {relationLabel(work.relationType)}{" "}
      <span className="font-mono text-xs">{work.identifier}</span>
    </p>
  );

  const renderFundingReference = (reference: FundingReference, index: number) => {
    const text = reference.awardNumber
      ? tStudy("funding.reference", { funder: reference.funderName, award: reference.awardNumber })
      : reference.funderName;
    const identifierType = reference.funderIdentifierType;
    const identifier =
      identifierType && reference.funderIdentifier
        ? tStudy("funding.identifierEntry", {
            type: identifierTypeLabel(identifierType),
            identifier: reference.funderIdentifier,
          })
        : null;

    return (
      <div key={index}>
        {renderValue(text)}
        {identifier && <p className="text-muted-foreground font-mono text-xs">{identifier}</p>}
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
            {renderList(tStudy("subjects.label"), hasSubjects, subjects.map(renderSubject))}
            {renderRow(t("studyDetails.experimentalDesign"), experiment.experimentalDesign)}
            {renderList(
              tStudy("relatedWork.title"),
              hasRelatedWork,
              relatedWork.map(renderRelatedWork),
            )}
            {renderRow(
              t("studyDetails.license"),
              experiment.license ? licenseLabel(experiment.license) : null,
            )}
            <div data-study-funding>
              {renderList(
                tStudy("funding.title"),
                hasFunding,
                fundingReferences.map(renderFundingReference),
              )}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm italic">{t("studyDetails.empty")}</p>
        )}
      </div>

      <ExperimentStudyDetailsDialog
        experimentId={experimentId}
        experiment={experiment}
        record={record}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </>
  );
}
