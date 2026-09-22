import { describe, expect, it } from "vitest";

import { deriveExperimentOnboardingState } from "./membership";

describe("deriveExperimentOnboardingState", () => {
  it("is undefined while no response has arrived", () => {
    expect(deriveExperimentOnboardingState(undefined)).toBeUndefined();
  });

  it("is none for a loaded empty list", () => {
    expect(deriveExperimentOnboardingState([])).toEqual({ kind: "none" });
  });

  it("is none for an authorship-only row, which the related slice still returns", () => {
    expect(deriveExperimentOnboardingState([{ membershipStatus: "none" }])).toEqual({
      kind: "none",
    });
  });

  it("is none for a pending request", () => {
    expect(deriveExperimentOnboardingState([{ membershipStatus: "pending_request" }])).toEqual({
      kind: "none",
    });
  });

  it("is member as soon as one row says member", () => {
    expect(
      deriveExperimentOnboardingState([
        { membershipStatus: "none" },
        { membershipStatus: "pending_request" },
        { membershipStatus: "member" },
      ]),
    ).toEqual({ kind: "member" });
  });

  it("tells an empty list apart from no list at all", () => {
    expect(deriveExperimentOnboardingState([])).not.toBeUndefined();
    expect(deriveExperimentOnboardingState(undefined)).toBeUndefined();
  });
});
