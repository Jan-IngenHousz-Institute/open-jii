import { describe, expect, it } from "vitest";
import { deriveOnboardingState, isJoinable } from "~/features/organizations/domain/membership";

import type { OrganizationDirectoryEntry } from "@repo/api/domains/organization/organization.schema";

function entry(overrides: Partial<OrganizationDirectoryEntry> = {}): OrganizationDirectoryEntry {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Photosynthesis Lab Utrecht",
    slug: "photosynthesis-lab",
    logo: null,
    type: "research_institute",
    description: null,
    location: "Utrecht",
    memberCount: 12,
    resourceCount: 9,
    visibility: "public",
    membershipStatus: "none",
    ...overrides,
  };
}

describe("deriveOnboardingState", () => {
  it("returns none for an empty directory", () => {
    expect(deriveOnboardingState([])).toEqual({ kind: "none" });
  });

  it("returns none when nothing is joined or requested", () => {
    expect(deriveOnboardingState([entry(), entry({ id: "b" })])).toEqual({ kind: "none" });
  });

  it("lets membership win over a pending request, whatever the order", () => {
    const pending = entry({ id: "pending", membershipStatus: "pending_request" });
    const member = entry({ id: "member", membershipStatus: "member" });

    expect(deriveOnboardingState([pending, member])).toEqual({ kind: "member" });
    expect(deriveOnboardingState([member, pending])).toEqual({ kind: "member" });
  });

  it("returns the first pending request in server order", () => {
    const first = entry({ id: "first", membershipStatus: "pending_request" });
    const second = entry({ id: "second", membershipStatus: "pending_request" });

    expect(deriveOnboardingState([entry(), first, second])).toEqual({
      kind: "pending",
      organization: first,
    });
  });
});

describe("isJoinable", () => {
  it("is true only for a public organization the caller is not in", () => {
    expect(isJoinable(entry())).toBe(true);
  });

  it("is false once a request is pending", () => {
    expect(isJoinable(entry({ membershipStatus: "pending_request" }))).toBe(false);
  });

  it("is false for a member", () => {
    expect(isJoinable(entry({ membershipStatus: "member" }))).toBe(false);
  });

  it("is false for a private organization", () => {
    expect(isJoinable(entry({ visibility: "private" }))).toBe(false);
  });
});
