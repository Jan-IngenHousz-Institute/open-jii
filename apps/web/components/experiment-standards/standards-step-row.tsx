"use client";

import Link from "next/link";

import type {
  StandardId,
  StandardsStep,
  StepReasonCode,
} from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import { Button } from "@repo/ui/components/button";

import { StepMarker } from "./step-marker";
import { StepStandards } from "./step-standards";
import { useStepCopy } from "./use-step-copy";
import { useStepFix } from "./use-step-fix";

interface StandardsStepRowProps {
  experimentId: string;
  step: StandardsStep;
  position: number;
  /** Members and viewers see the step without its fix, and so does an archived experiment. */
  canFix: boolean;
  onOpenFields: (standard: StandardId, reason: StepReasonCode) => void;
}

/** One step: what to do, what it acts on, what it moves, and the one action that does it. */
export function StandardsStepRow({
  experimentId,
  step,
  position,
  canFix,
  onOpenFields,
}: StandardsStepRowProps) {
  const copy = useStepCopy()(step.reason);
  const fix = useStepFix(experimentId)(step.reason);

  // A member connects their own ORCID iD, which needs no right to edit the experiment.
  const isOwnAction = step.reason.code === "members-without-orcid";
  const isFixShown = fix !== null && (canFix || isOwnAction);
  // A step tied to no standard either holds every dataset or, like skipped plots, only informs.
  const hasStandards = step.standards.length > 0 || step.holdsFreeze;
  const firstStandard = step.standards.at(0);

  const handleOpenFields = () => {
    if (firstStandard !== undefined) {
      onOpenFields(firstStandard, step.reason.code);
    }
  };

  return (
    <li className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
      <StepMarker holdsFreeze={step.holdsFreeze} position={position} />

      <div className="min-w-0 flex-1 space-y-1">
        {firstStandard === undefined ? (
          <p className="text-sm font-medium">{copy.title}</p>
        ) : (
          <button
            type="button"
            onClick={handleOpenFields}
            className="text-left text-sm font-medium hover:underline"
          >
            {copy.title}
          </button>
        )}
        {copy.subjects === null ? null : (
          <p className="text-muted-foreground text-xs">{copy.subjects}</p>
        )}
        {copy.note === null ? null : <p className="text-muted-foreground text-xs">{copy.note}</p>}
        {hasStandards ? <StepStandards standards={step.standards} /> : null}
      </div>

      {isFixShown ? (
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href={fix.href}>{fix.label}</Link>
        </Button>
      ) : null}
    </li>
  );
}
