import { withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import type { QueryKey } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import {
  organizationAuthFamilies,
  organizationInvitationsQueryKey,
  organizationMemberRowFamily,
  organizationMembershipFamilies,
  organizationProfileFamilies,
  organizationTeamFamilies,
} from "./organization-cache";

/**
 * These sets are what keeps the two data idioms on these screens agreeing: a Better
 * Auth write has to invalidate the oRPC queries it moved, and vice versa. The
 * assertions are about membership of the sets rather than their exact contents, so
 * adding a family stays free while dropping a load-bearing one fails.
 */

/**
 * Whether `families` contains a key that is a prefix of (or equal to) `key` — the
 * matching React Query itself does. Compared position by position: a segment's value
 * alone would let a repeated segment match at the wrong index.
 */
function invalidates(families: QueryKey[], key: QueryKey): boolean {
  return families.some(
    (family) =>
      family.length <= key.length &&
      family.every((segment, index) => JSON.stringify(segment) === JSON.stringify(key[index])),
  );
}

describe("organizationMemberRowFamily", () => {
  it("is a prefix of any organization's map, for any principal", () => {
    const concrete = withPrincipal([...organizationMemberRowFamily(), "org-1"], "user-1");

    // Prefix invalidation is the point: the id and the principal sit after it, so one
    // key clears every cached map rather than only the one currently on screen.
    expect(invalidates([organizationMemberRowFamily()], concrete)).toBe(true);
  });

  it("does not reach the other Better Auth organization reads", () => {
    const invitations = organizationInvitationsQueryKey("user-1", "org-1");

    expect(invalidates([organizationMemberRowFamily()], invitations)).toBe(false);
  });
});

describe("organizationMembershipFamilies", () => {
  const families = organizationMembershipFamilies();

  it("refreshes the Better Auth member-row map", () => {
    // The only source of the row id a role write addresses. Without this a newly
    // approved member has no role control, and a rejoin can address a deleted row.
    expect(
      invalidates(families, withPrincipal([...organizationMemberRowFamily(), "org-1"], "user-1")),
    ).toBe(true);
  });

  it("refreshes the roster, the counts and the join-request queue", () => {
    for (const key of [
      orpc.organizations.listOrganizationMembers.key(),
      orpc.organizations.listOrganizationJoinRequests.key(),
      orpc.organizations.listMyOrganizations.key(),
      orpc.organizations.getOrganization.key(),
      orpc.organizations.listOrganizations.key(),
    ]) {
      expect(invalidates(families, key), JSON.stringify(key)).toBe(true);
    }
  });

  it("refreshes the collaborators lists, where membership decides the outside badge", () => {
    expect(invalidates(families, orpc.sharing.listGrants.key())).toBe(true);
  });

  it("refreshes global search, where membership controls visibility and roster matching", () => {
    expect(invalidates(families, orpc.search.globalSearch.key())).toBe(true);
  });
});

describe("organizationAuthFamilies", () => {
  it("covers every Better Auth organization read at once", () => {
    const families = organizationAuthFamilies();

    for (const key of [
      organizationInvitationsQueryKey("user-1", "org-1"),
      withPrincipal([...organizationMemberRowFamily(), "org-1"], "user-1"),
    ]) {
      expect(invalidates(families, key), JSON.stringify(key)).toBe(true);
    }
  });
});

describe("organizationProfileFamilies", () => {
  it("stays the organization's own fields, without the grant enrichment", () => {
    // Creating an organization uses this set and cannot affect any grant, so the
    // collaborators family is added at the call sites that can — rename and delete.
    expect(invalidates(organizationProfileFamilies(), orpc.sharing.listGrants.key())).toBe(false);
  });

  it("refreshes global search after organization create, update or delete", () => {
    expect(invalidates(organizationProfileFamilies(), orpc.search.globalSearch.key())).toBe(true);
  });
});

describe("organizationTeamFamilies", () => {
  it("reaches both the picker source and the grant rows a team appears on", () => {
    const families = organizationTeamFamilies();

    for (const key of [
      orpc.organizations.listOrganizationTeams.key(),
      orpc.organizations.listGranteeTeams.key(),
      orpc.sharing.listGrants.key(),
      orpc.search.globalSearch.key(),
    ]) {
      expect(invalidates(families, key), JSON.stringify(key)).toBe(true);
    }
  });
});
