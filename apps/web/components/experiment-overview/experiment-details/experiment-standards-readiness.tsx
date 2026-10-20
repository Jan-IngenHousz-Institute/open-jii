"use client";

import { STANDARDS_READINESS_ANCHOR } from "@/components/experiment-overview/experiment-readiness-summary";
import { useExperimentStandardsReadiness } from "~/hooks/experiment/useExperimentStandardsReadiness/useExperimentStandardsReadiness";

import type { Experiment } from "@repo/api/domains/experiment/experiment.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

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

/** Points at the readiness screen once it answers, and counts study fields until then. */
export function ExperimentStandardsReadiness({ experiment }: ExperimentStandardsReadinessProps) {
  const { t } = useTranslation("experiments");
  const licenseLabel = useDataLicenseLabel();
  const { t: tStandards } = useTranslation("standards");
  const { data: readiness } = useExperimentStandardsReadiness(experiment.id);

  const { filled, total } = countStudyDescriptors(experiment);

  if (readiness) {
    return (
      <div className="space-y-1">
        <h4 className="text-sm font-medium">{t("standardsReadiness.title")}</h4>
        <Button asChild variant="link" className="h-auto p-0">
          <a href={`#${STANDARDS_READINESS_ANCHOR}`}>{tStandards("readiness.seeAll")}</a>
        </Button>
      </div>
    );
  }

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
