import type { ExperimentMembershipStatus } from "@repo/api/domains/experiment/experiment.schema";

export type ExperimentOnboardingState = { kind: "member" } | { kind: "none" };

/**
 * Presence in the `related` slice is not membership: that slice also keeps rows
 * the caller merely authored, whose status is `none`. Only `membershipStatus`
 * answers "can this person measure".
 */
export function deriveExperimentOnboardingState(
  rows: readonly { membershipStatus: ExperimentMembershipStatus }[] | undefined,
): ExperimentOnboardingState | undefined {
  if (rows === undefined) return undefined;
  return rows.some((row) => row.membershipStatus === "member")
    ? { kind: "member" }
    : { kind: "none" };
}
