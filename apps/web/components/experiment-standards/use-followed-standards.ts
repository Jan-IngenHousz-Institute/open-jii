import { useExperimentStandards } from "~/hooks/experiment/useExperimentStandards/useExperimentStandards";

import {
  ALWAYS_FOLLOWED,
  zFollowableStandardId,
} from "@repo/api/domains/experiment/standards/experiment-standards.schema";
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
  return standard === ALWAYS_FOLLOWED || (isFollowable(standard) && state !== "not-applicable");
}

export interface FollowedStandards {
  /** Every standard the platform reports on, for choosing. */
  all: StandardReadiness[];
  chosen: FollowableStandardId[];
  /** The chosen standards in the platform's order, then the OpenAIRE record. */
  followed: StandardReadiness[];
  /** The steps that move a followed standard or hold every dataset, the ones holding Freeze first. */
  steps: StandardsStep[];
  /** How many steps hold Freeze. */
  holding: number;
}

function narrow(answer: ExperimentStandards): FollowedStandards {
  const followedIds: StandardId[] = [...answer.followed, ALWAYS_FOLLOWED];

  const isFollowed = (standard: StandardId) => followedIds.includes(standard);
  const isChosen = (row: StandardReadiness) =>
    isFollowable(row.standard) && answer.followed.includes(row.standard);
  const isAlwaysFollowed = (row: StandardReadiness) => row.standard === ALWAYS_FOLLOWED;

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
    followed: [...answer.standards.filter(isChosen), ...answer.standards.filter(isAlwaysFollowed)],
    steps,
    holding: steps.filter((step) => step.holdsFreeze).length,
  };
}

/** The standards answer narrowed to what the experiment follows, with the query behind it. */
export function useFollowedStandards(experimentId: string) {
  const query = useExperimentStandards(experimentId);

  return { ...query, followed: query.data ? narrow(query.data) : undefined };
}
