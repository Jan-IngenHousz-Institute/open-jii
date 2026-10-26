"use client";

import type { Experiment } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";

import { useDataLicenseLabel } from "./use-data-license-label";

interface ExperimentStandardsReadinessProps {
  experiment: Experiment;
}

/** How many of the study descriptors carry a value, out of how many exist. */
export function countStudyDescriptors(experiment: Experiment): {
  filled: number;
  total: number;
} {
  const descriptors = [
    experiment.startDate,
    experiment.endDate,
    experiment.organism,
    experiment.experimentalDesign,
    experiment.growthFacility,
    experiment.license,
  ];

  return { filled: descriptors.filter(Boolean).length, total: descriptors.length };
}

export function ExperimentStandardsReadiness({ experiment }: ExperimentStandardsReadinessProps) {
  const { t } = useTranslation("experiments");
  const licenseLabel = useDataLicenseLabel();

  const { filled, total } = countStudyDescriptors(experiment);

  return (
    <div className="space-y-1">
      <h4 className="text-sm font-medium">{t("standardsReadiness.title")}</h4>
      <div className="text-muted-foreground space-y-0.5 text-sm">
        <p>
          {t("standardsReadiness.studyFields")}{" "}
          {t("standardsReadiness.fieldsCount", { filled, total })}
        </p>
        <p>
          {t("standardsReadiness.license")}{" "}
          {experiment.license
            ? licenseLabel(experiment.license)
            : t("standardsReadiness.licenseNone")}
        </p>
      </div>
    </div>
  );
}
