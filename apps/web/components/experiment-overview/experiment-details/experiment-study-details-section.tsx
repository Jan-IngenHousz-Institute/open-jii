"use client";

import { useState } from "react";

import type { Experiment } from "@repo/api/domains/experiment/experiment.schema";
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
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const canEdit = hasAccess && !isArchived;
  const hasPeriod = Boolean(experiment.startDate ?? experiment.endDate);
  const notSet = t("studyDetails.dateNotSet");
  const period = `${experiment.startDate ?? notSet} → ${experiment.endDate ?? notSet}`;
  const hasAnyDetail =
    hasPeriod ||
    Boolean(experiment.organism) ||
    Boolean(experiment.growthFacility) ||
    Boolean(experiment.experimentalDesign) ||
    Boolean(experiment.license);

  const renderRow = (label: string, value: string) => (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="truncate text-sm" title={value}>
        {value}
      </p>
    </div>
  );

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

        {hasAnyDetail ? (
          <div className="space-y-2">
            {hasPeriod && renderRow(t("studyDetails.period"), period)}
            {experiment.organism && renderRow(t("studyDetails.organism"), experiment.organism)}
            {experiment.growthFacility &&
              renderRow(t("studyDetails.growthFacility"), experiment.growthFacility)}
            {experiment.experimentalDesign &&
              renderRow(t("studyDetails.experimentalDesign"), experiment.experimentalDesign)}
            {experiment.license &&
              renderRow(t("studyDetails.license"), licenseLabel(experiment.license))}
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
