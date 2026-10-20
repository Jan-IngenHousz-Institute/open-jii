"use client";

import type { ReadinessStep } from "@/components/experiment-standards/concepts/readiness-steps";
import { Lock } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";

import { StepNumber } from "./step-number";
import { StepStandards } from "./step-standards";

interface WaitingPublishRowProps {
  step: ReadinessStep;
  waitingFor: number;
}

/** Publishing, last in the list and held until the steps above it are done. */
export function WaitingPublishRow({ step, waitingFor }: WaitingPublishRowProps) {
  const { t } = useTranslation("readinessConceptD");
  const { t: tStandards } = useTranslation("standards");

  return (
    <li className="bg-muted/30 flex items-center gap-3 px-4 py-3">
      <StepNumber>
        <Lock aria-hidden className="size-3" />
      </StepNumber>

      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-muted-foreground text-sm font-medium">
          {tStandards(`step.${step.action}`, { count: step.subjects })}
        </p>
        <StepStandards standards={step.standards}>
          <span className="text-muted-foreground text-xs">
            {t("steps.publishWaits", { count: waitingFor })}
          </span>
        </StepStandards>
      </div>

      <Button variant="outline" size="sm" className="shrink-0" disabled>
        {t("fix.publish-dataset")}
      </Button>
    </li>
  );
}
