"use client";

import type { StandardId } from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { useTranslation } from "@repo/i18n";

import type { ReadinessStep } from "../readiness-steps";
import { StepAction } from "./step-action";
import { StepGainChip } from "./step-gain-chip";
import type { StandardGain } from "./step-gains";
import { StepSubject } from "./step-subject";

interface ReadinessStepRowProps {
  experimentId: string;
  step: ReadinessStep;
  position: number;
  gains: StandardGain[];
  onOpenStandard: (standard: StandardId) => void;
}

/** One ranked step: what to do, what it acts on, where it moves the trial, and the way there. */
export function ReadinessStepRow({
  experimentId,
  step,
  position,
  gains,
  onOpenStandard,
}: ReadinessStepRowProps) {
  const { t } = useTranslation("standards");

  const renderGain = (gain: StandardGain) => (
    <StepGainChip key={gain.standard} gain={gain} onOpen={onOpenStandard} />
  );

  return (
    <li className="flex items-start gap-4 px-4 py-4">
      <span className="text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">
        {position}
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium">{t(`step.${step.action}`, { count: step.subjects })}</p>
        <StepSubject experimentId={experimentId} action={step.action} />
        <div className="flex flex-wrap gap-1.5 pt-1.5">{gains.map(renderGain)}</div>
      </div>

      <StepAction experimentId={experimentId} action={step.action} isNext={position === 1} />
    </li>
  );
}
