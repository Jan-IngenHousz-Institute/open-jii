import { render, screen } from "@testing-library/react-native";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { ExperimentMembershipTag } from "./experiment-membership-tag";

vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({ "membership.joined": "Joined", "membership.requested": "Requested" })[key] ?? key,
  }),
}));

describe("ExperimentMembershipTag", () => {
  it("says Joined for a member, not 'member', which reads as a role", () => {
    render(<ExperimentMembershipTag membershipStatus="member" />);

    expect(screen.getByText("Joined")).toBeTruthy();
    expect(screen.queryByText(/member/iu)).toBeNull();
  });

  it("says Requested while a decision is pending", () => {
    render(<ExperimentMembershipTag membershipStatus="pending_request" />);

    expect(screen.getByText("Requested")).toBeTruthy();
  });

  it("renders nothing when the caller has no relationship to the experiment", () => {
    const { toJSON } = render(<ExperimentMembershipTag membershipStatus="none" />);

    expect(toJSON()).toBeNull();
  });
});
