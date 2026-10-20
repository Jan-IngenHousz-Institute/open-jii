import { useReadinessOverview } from "@/components/experiment-standards/concepts/readiness-steps";
import type { ReadinessStep } from "@/components/experiment-standards/concepts/readiness-steps";

import type {
  StandardId,
  StandardReadiness,
} from "@repo/api/domains/experiment/standards/experiment-standards.schema";

export interface FollowedReadiness {
  /** Every standard the platform reports on, for choosing. */
  all: StandardReadiness[];
  /** The followed standards, in the order their first step comes. */
  followed: StandardReadiness[];
  /** What publishing waits for: the ranked steps that move a followed standard, but publishing. */
  stepsBeforePublishing: ReadinessStep[];
  /** The step that publishes, when a followed standard needs a published dataset. */
  publishStep: ReadinessStep | undefined;
  /** Followed standards that still have a step before publishing. */
  waitingOn: StandardId[];
}

/** The readiness overview narrowed to what this trial follows, once both answers are in. */
export function useFollowedReadiness(
  experimentId: string,
  followed: StandardId[],
): FollowedReadiness | undefined {
  const overview = useReadinessOverview(experimentId);

  if (!overview) {
    return undefined;
  }

  // Each step names only the followed standards it moves.
  const steps = overview.steps
    .map((step) => ({ ...step, standards: step.standards.filter((id) => followed.includes(id)) }))
    .filter((step) => step.standards.length > 0);
  const stepsBeforePublishing = steps.filter((step) => step.action !== "publish-dataset");

  const firstStep = (standard: StandardId) => {
    const index = steps.findIndex((step) => step.standards.includes(standard));
    return index === -1 ? steps.length : index;
  };
  const followedRows = overview.standards
    .filter((row) => followed.includes(row.standard))
    .sort((a, b) => firstStep(a.standard) - firstStep(b.standard));

  const waitingOn = followedRows
    .map((row) => row.standard)
    .filter((standard) => stepsBeforePublishing.some((step) => step.standards.includes(standard)));

  return {
    all: overview.standards,
    followed: followedRows,
    stepsBeforePublishing,
    publishStep: steps.find((step) => step.action === "publish-dataset"),
    waitingOn,
  };
}
