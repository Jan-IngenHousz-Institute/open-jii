"use client";

import { formatList } from "@/components/calibrations/format-list";
import { useFollowedStandards } from "@/components/experiment-standards/use-followed-standards";
import Link from "next/link";
import { useLocale } from "~/hooks/useLocale";

import type { Experiment } from "@repo/api/domains/experiment/experiment.schema";
import { ALWAYS_FOLLOWED } from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import type { FollowableStandardId } from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

interface ExperimentStandardsReadinessProps {
  experiment: Experiment;
}

/**
 * The details card's one line: what the experiment follows and how many steps hold Freeze, linking
 * to the steps on the Datasets tab. The tab shows loading and a failure with Retry, so the line
 * waits for the answer and leaves a failure out.
 */
export function ExperimentStandardsReadiness({ experiment }: ExperimentStandardsReadinessProps) {
  const { t } = useTranslation("standards");
  const locale = useLocale();
  const { followed } = useFollowedStandards(experiment.id);

  if (followed === undefined) {
    return null;
  }

  const { chosen, holding } = followed;
  const isHeld = holding > 0;
  const inSentence = (standard: FollowableStandardId) => t(`standard.${standard}.inSentence`);

  const follows =
    chosen.length > 0
      ? t("line.follows", { names: formatList(locale, chosen.map(inSentence)) })
      : t("line.followsOnly", { name: t(`standard.${ALWAYS_FOLLOWED}.inSentence`) });
  const progress = isHeld ? t("line.steps", { count: holding }) : t("line.ready");
  const datasetsHref = `/${locale}/platform/experiments/${experiment.id}/datasets`;

  return (
    <div className="space-y-1" data-testid="standards-line">
      <h4 className="text-sm font-medium">{t("line.title")}</h4>
      <p className="text-muted-foreground text-sm">
        {follows} {progress}
      </p>
      <Button asChild variant="link" className="h-auto p-0">
        <Link href={datasetsHref}>{isHeld ? t("line.seeSteps") : t("line.openDatasets")}</Link>
      </Button>
    </div>
  );
}
