"use client";

import type { ReadinessStep } from "@/components/experiment-standards/concepts/readiness-steps";
import type { ReactNode } from "react";

import { FollowedStepRow } from "./followed-step-row";

interface FollowedStepListProps {
  experimentId: string;
  /** The steps before publishing, ranked. */
  steps: ReadinessStep[];
  /** A last row after the steps, such as the publish action. */
  children?: ReactNode;
}

export function FollowedStepList({ experimentId, steps, children }: FollowedStepListProps) {
  const renderStep = (step: ReadinessStep, index: number) => (
    <FollowedStepRow
      key={step.action}
      experimentId={experimentId}
      step={step}
      position={index + 1}
    />
  );

  return (
    <ol>
      {steps.map(renderStep)}
      {children}
    </ol>
  );
}
