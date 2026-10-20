"use client";

import type { ReadinessStep } from "@/components/experiment-standards/concepts/readiness-steps";

import { FollowedStepRow } from "./followed-step-row";
import { WaitingPublishRow } from "./waiting-publish-row";

interface FollowedStepListProps {
  experimentId: string;
  /** The steps before publishing, ranked. */
  steps: ReadinessStep[];
  /** Publishing, last: held while any step above remains. */
  publishStep?: ReadinessStep;
}

export function FollowedStepList({ experimentId, steps, publishStep }: FollowedStepListProps) {
  const isPublishWaiting = steps.length > 0;

  const renderStep = (step: ReadinessStep, index: number) => (
    <FollowedStepRow
      key={step.action}
      experimentId={experimentId}
      step={step}
      position={index + 1}
    />
  );

  const renderPublish = (step: ReadinessStep) =>
    isPublishWaiting ? (
      <WaitingPublishRow step={step} waitingFor={steps.length} />
    ) : (
      renderStep(step, steps.length)
    );

  return (
    <ol>
      {steps.map(renderStep)}
      {publishStep ? renderPublish(publishStep) : null}
    </ol>
  );
}
