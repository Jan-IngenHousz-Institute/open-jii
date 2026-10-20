"use client";

import type {
  ReadinessAction,
  ReadinessStep,
} from "@/components/experiment-standards/concepts/readiness-steps";
import Link from "next/link";
import { useLocale } from "~/hooks/useLocale";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import { StepNumber } from "./step-number";
import { StepStandards } from "./step-standards";

interface FollowedStepRowProps {
  experimentId: string;
  step: ReadinessStep;
  position: number;
}

/** One ranked step: what to do, which followed standards it moves, and the screen that does it. */
export function FollowedStepRow({ experimentId, step, position }: FollowedStepRowProps) {
  const { t } = useTranslation("readinessConceptD");
  const { t: tStandards } = useTranslation("standards");
  const locale = useLocale();

  const experimentPath = `/${locale}/platform/experiments/${experimentId}`;
  const fixPaths: Record<ReadinessAction, string> = {
    "add-location": experimentPath,
    "describe-columns": `${experimentPath}/data`,
    "add-terms": `${experimentPath}/data`,
    // Authors connect their own ORCID iD, so this opens the people to remind.
    "connect-orcid": `${experimentPath}/collaborators`,
    "open-layout": `${experimentPath}/layout`,
    "publish-dataset": `${experimentPath}/datasets`,
  };

  return (
    <li className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
      <StepNumber>{position}</StepNumber>

      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium">
          {tStandards(`step.${step.action}`, { count: step.subjects })}
        </p>
        <StepStandards standards={step.standards} />
      </div>

      <Button asChild variant="outline" size="sm" className="shrink-0">
        <Link href={fixPaths[step.action]}>{t(`fix.${step.action}`)}</Link>
      </Button>
    </li>
  );
}
