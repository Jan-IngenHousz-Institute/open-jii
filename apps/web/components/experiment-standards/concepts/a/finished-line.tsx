"use client";

import { CheckCircle2 } from "lucide-react";

import type { StandardId } from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";

import type { FinishedWork } from "./finished-work";

interface FinishedLineProps {
  finished: FinishedWork[];
  /** Standards already met, named by where they let the trial go. */
  ready: StandardId[];
}

/** Everything already in place, folded into one line under the steps. */
export function FinishedLine({ finished, ready }: FinishedLineProps) {
  const { t, i18n } = useTranslation("readinessConceptA");
  const { t: tStandards } = useTranslation("standards");

  const hasFinished = finished.length > 0;
  const isReadySomewhere = ready.length > 0;

  if (!hasFinished && !isReadySomewhere) {
    return null;
  }

  const items = new Intl.ListFormat(i18n.language, { type: "unit", style: "short" }).format(
    finished.map((work) => t(`finished.${work}`)),
  );
  const destinations = new Intl.ListFormat(i18n.language, { type: "conjunction" }).format(
    ready.map((standard) => tStandards(`destination.${standard}`)),
  );

  return (
    <p className="text-muted-foreground flex items-start gap-2 px-4 py-3 text-sm">
      <CheckCircle2 aria-hidden className="text-status-active-foreground mt-0.5 size-4 shrink-0" />
      <span>
        {hasFinished && t("done", { items })} {isReadySomewhere && t("ready", { destinations })}
      </span>
    </p>
  );
}
