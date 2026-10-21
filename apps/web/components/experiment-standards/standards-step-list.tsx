"use client";

import type { ReactNode } from "react";

import type {
  StandardId,
  StandardsStep,
  StepReasonCode,
} from "@repo/api/domains/experiment/standards/experiment-standards.schema";

import { StandardsStepRow } from "./standards-step-row";

interface StandardsStepListProps {
  experimentId: string;
  /** Ranked, the steps that hold Freeze first. */
  steps: StandardsStep[];
  canFix: boolean;
  onOpenFields: (standard: StandardId, reason: StepReasonCode) => void;
  /** A last row after the steps, such as Publish a dataset. */
  children?: ReactNode;
}

export function StandardsStepList({
  experimentId,
  steps,
  canFix,
  onOpenFields,
  children,
}: StandardsStepListProps) {
  const renderStep = (step: StandardsStep, index: number) => (
    <StandardsStepRow
      key={step.reason.code}
      experimentId={experimentId}
      step={step}
      position={index + 1}
      canFix={canFix}
      onOpenFields={onOpenFields}
    />
  );

  return (
    <ol>
      {steps.map(renderStep)}
      {children}
    </ol>
  );
}
