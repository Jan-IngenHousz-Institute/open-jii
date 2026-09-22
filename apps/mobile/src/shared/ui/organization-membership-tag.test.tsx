import { render, screen } from "@testing-library/react-native";
import React from "react";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";

import { OrganizationMembershipTags } from "./organization-membership-tag";

vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "membership.private": "Private",
        "membership.member": "Joined",
        "membership.requested": "Requested",
      })[key] ?? key,
  }),
}));

describe("OrganizationMembershipTags", () => {
  it("renders nothing for a public organization the caller is not in", () => {
    const { toJSON } = render(
      <OrganizationMembershipTags visibility="public" membershipStatus="none" />,
    );

    expect(toJSON()).toBeNull();
  });

  it("says Joined rather than Member, so it never reads as a role", () => {
    render(<OrganizationMembershipTags visibility="public" membershipStatus="member" />);

    expect(screen.getByText("Joined")).toBeTruthy();
    expect(screen.queryByText("Member")).toBeNull();
  });

  it("puts Private first, then the caller's own state", () => {
    render(<OrganizationMembershipTags visibility="private" membershipStatus="member" />);

    expect(screen.getByText("Private")).toBeTruthy();
    expect(screen.getByText("Joined")).toBeTruthy();
  });

  it("tags a pending request", () => {
    render(<OrganizationMembershipTags visibility="public" membershipStatus="pending_request" />);

    expect(screen.getByText("Requested")).toBeTruthy();
  });

  describe("showMemberTag={false} — what the detail screen passes", () => {
    it("drops the Joined tag, since the role tag below says it better", () => {
      const { toJSON } = render(
        <OrganizationMembershipTags
          visibility="public"
          membershipStatus="member"
          showMemberTag={false}
        />,
      );

      expect(screen.queryByText("Joined")).toBeNull();
      expect(toJSON()).toBeNull();
    });

    it("still shows Private for a private organization the caller belongs to", () => {
      render(
        <OrganizationMembershipTags
          visibility="private"
          membershipStatus="member"
          showMemberTag={false}
        />,
      );

      expect(screen.getByText("Private")).toBeTruthy();
      expect(screen.queryByText("Joined")).toBeNull();
    });

    it("leaves a pending request alone", () => {
      render(
        <OrganizationMembershipTags
          visibility="public"
          membershipStatus="pending_request"
          showMemberTag={false}
        />,
      );

      expect(screen.getByText("Requested")).toBeTruthy();
    });
  });
});
