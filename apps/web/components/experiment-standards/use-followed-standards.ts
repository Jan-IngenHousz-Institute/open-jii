import { useExperimentStandards } from "~/hooks/experiment/useExperimentStandards/useExperimentStandards";

import { zFollowableStandardId } from "@repo/api/domains/experiment/standards/experiment-standards.schema";
import type {
  ExperimentStandards,
  FollowableStandardId,
  StandardId,
  StandardReadiness,
  StandardsStep,
} from "@repo/api/domains/experiment/standards/experiment-standards.schema";

export function isFollowable(standard: StandardId): standard is FollowableStandardId {
  return zFollowableStandardId.safeParse(standard).success;
}

/** A standard can be followed only where a researcher step can exist for this experiment. */
export function canFollow({ standard, state }: StandardReadiness): boolean {
  return isFollowable(standard) && state !== "not-applicable";
}

export interface FollowedStandards {
  /** Every standard the platform reports on, for choosing. */
  all: StandardReadiness[];
  chosen: FollowableStandardId[];
  /** The chosen standards in the platform's order. */
  followed: StandardReadiness[];
  /** The steps that move a followed standard or hold every dataset, the ones holding Freeze first. */
  steps: StandardsStep[];
  /** How many steps hold Freeze. */
  holding: number;
}

function narrow(answer: ExperimentStandards): FollowedStandards {
  const isFollowed = (standard: StandardId) =>
    isFollowable(standard) && answer.followed.includes(standard);

  // A step with no standard holds every dataset, whatever the experiment follows.
  const isShown = (step: StandardsStep) =>
    step.standards.length === 0 || step.standards.some(isFollowed);

  const shown = answer.steps
    .filter(isShown)
    .map((step) => ({ ...step, standards: step.standards.filter(isFollowed) }));
  const steps = [
    ...shown.filter((step) => step.holdsFreeze),
    ...shown.filter((step) => !step.holdsFreeze),
  ];

  return {
    all: answer.standards,
    chosen: answer.followed,
    followed: answer.standards.filter((row) => isFollowed(row.standard)),
    steps,
    holding: steps.filter((step) => step.holdsFreeze).length,
  };
}

/** The standards answer narrowed to what the experiment follows, with the query behind it. */
export function useFollowedStandards(experimentId: string) {
  const query = useExperimentStandards(experimentId);

  return { ...query, followed: query.data ? narrow(query.data) : undefined };
}
