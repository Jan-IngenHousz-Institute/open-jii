"use client";

import type {
  ReadinessAction,
  ReadinessStep,
} from "@/components/experiment-standards/concepts/readiness-steps";
import Link from "next/link";
import { useLocale } from "~/hooks/useLocale";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

interface DestinationStepRowProps {
  experimentId: string;
  step: ReadinessStep;
}

/** One step a destination still waits on, with a link to the screen that takes it. */
export function DestinationStepRow({ experimentId, step }: DestinationStepRowProps) {
  const { t } = useTranslation("readinessConceptB");
  const { t: tStandards } = useTranslation("standards");
  const locale = useLocale();

  const experimentPath = `/${locale}/platform/experiments/${experimentId}`;
  const stepPaths: Record<ReadinessAction, string> = {
    "add-location": experimentPath,
    "describe-columns": `${experimentPath}/data`,
    "add-terms": `${experimentPath}/data`,
    // Authors connect ORCID on their own account, so this opens the people to ask.
    "connect-orcid": `${experimentPath}/collaborators`,
    "open-layout": `${experimentPath}/layout`,
    "publish-dataset": `${experimentPath}/datasets`,
  };

  return (
    <li className="flex items-baseline justify-between gap-3 text-sm">
      <span className="min-w-0">{tStandards(`step.${step.action}`, { count: step.subjects })}</span>
      <Button asChild variant="link" className="h-auto shrink-0 p-0 text-sm">
        <Link href={stepPaths[step.action]}>{t(`action.${step.action}`)}</Link>
      </Button>
    </li>
  );
}
