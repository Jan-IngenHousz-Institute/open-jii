"use client";

import { StatusBadge } from "@/components/shared/status-badge";
import Link from "next/link";
import { useLocale } from "~/hooks/useLocale";

import type { StandardId } from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import type { ReadinessAction, ReadinessStep } from "../readiness-steps";

/** The experiment page where each step is done. */
const STEP_PAGES: Record<ReadinessAction, string> = {
  "add-location": "",
  "describe-columns": "/data",
  "add-terms": "/data",
  "connect-orcid": "/collaborators",
  "open-layout": "/layout",
  "publish-dataset": "/datasets",
};

interface ReadinessStepRowProps {
  experimentId: string;
  step: ReadinessStep;
  position: number;
  /** Closes the sheet, since a step done on this page would otherwise stay behind it. */
  onFollow: () => void;
}

/** One step: what to do, where it leads, and the page that does it. */
export function ReadinessStepRow({
  experimentId,
  step,
  position,
  onFollow,
}: ReadinessStepRowProps) {
  const { t } = useTranslation("readinessConceptC");
  const { t: tStandards } = useTranslation("standards");
  const locale = useLocale();

  // Keeps the concept on, so the page a step opens shows its hint.
  const href = `/${locale}/platform/experiments/${experimentId}${STEP_PAGES[step.action]}?readiness=c`;

  const renderDestination = (standard: StandardId) => (
    <StatusBadge key={standard} tone="featured">
      {tStandards(`destination.${standard}`)}
    </StatusBadge>
  );

  return (
    <li className="flex items-start gap-3 px-3 py-3">
      <span className="bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums">
        {position}
      </span>

      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-sm font-medium">
          {tStandards(`step.${step.action}`, { count: step.subjects })}
        </p>
        <div className="flex flex-wrap gap-1">{step.standards.map(renderDestination)}</div>
      </div>

      <Button asChild variant="link" className="h-auto shrink-0 p-0 pt-0.5 text-xs">
        <Link href={href} onClick={onFollow}>
          {t(`fix.${step.action}`)}
        </Link>
      </Button>
    </li>
  );
}
