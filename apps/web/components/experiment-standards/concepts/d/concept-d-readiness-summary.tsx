"use client";

import { formatList } from "@/components/calibrations/format-list";
import Link from "next/link";
import { useLocale } from "~/hooks/useLocale";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import { useFollowedReadiness } from "./use-followed-readiness";
import { REQUIRED_STANDARD, useFollowedStandards } from "./use-followed-standards";

interface ConceptDReadinessSummaryProps {
  experimentId: string;
}

/** The details card's one line under Concept D: what the trial follows and how far publishing is. */
export function ConceptDReadinessSummary({ experimentId }: ConceptDReadinessSummaryProps) {
  const { t } = useTranslation("readinessConceptD");
  const { t: tExperiments } = useTranslation("experiments");
  const { t: tStandards } = useTranslation("standards");
  const locale = useLocale();
  const { followed } = useFollowedStandards();
  const readiness = useFollowedReadiness(experimentId, followed);

  if (!readiness) {
    return null;
  }

  const chosen = readiness.followed
    .map((row) => row.standard)
    .filter((standard) => standard !== REQUIRED_STANDARD);
  const floor = readiness.followed.find((row) => row.standard === REQUIRED_STANDARD);
  const stepCount = readiness.stepsBeforePublishing.length;
  const hasStepsLeft = stepCount > 0;
  const isFundingMissing = floor?.reason.code === "funding-missing";

  const follows =
    chosen.length > 0
      ? t("summary.follows", {
          names: formatList(
            locale,
            chosen.map((standard) => tStandards(`destination.${standard}`)),
          ),
        })
      : t("summary.followsFloor", { floor: tStandards(`destination.${REQUIRED_STANDARD}`) });

  const progress = () => {
    if (hasStepsLeft) {
      return t("summary.steps", { count: stepCount });
    }
    if (isFundingMissing) {
      return t("summary.needsFunding");
    }
    return t("summary.ready");
  };

  // Scaffold: the concept and the choice ride on the address, so the tab opens as chosen here.
  const query = new URLSearchParams({ readiness: "d", follow: followed.join(",") });
  const datasetsHref = `/${locale}/platform/experiments/${experimentId}/datasets?${query.toString()}`;

  return (
    <div className="space-y-1" data-testid="concept-d-readiness-summary">
      <h4 className="text-sm font-medium">{tExperiments("standardsReadiness.title")}</h4>
      <p className="text-muted-foreground text-sm">
        {t("summary.line", { follows, progress: progress() })}
      </p>
      <Button asChild variant="link" className="h-auto p-0">
        <Link href={datasetsHref}>
          {hasStepsLeft ? t("summary.seeSteps") : t("summary.openDatasets")}
        </Link>
      </Button>
    </div>
  );
}
