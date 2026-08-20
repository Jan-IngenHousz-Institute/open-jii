import { describe, expect, it } from "vitest";

import { roles } from "../access";
import {
  ORG_ROLES,
  ORG_SLUG_FORMAT_MESSAGE,
  ORG_SLUG_MAX_LENGTH,
  ORG_SLUG_RESERVED_MESSAGE,
  isCanonicalOrgRole,
  isOwnerRole,
  organizationSlugRejection,
} from "./rules";

describe("organization slug rules", () => {
  it.each(["lab", "open-jii", "lab2", "a-b-c", "x"])("accepts %s", (slug) => {
    expect(organizationSlugRejection(slug)).toBeNull();
  });

  it.each([
    ["", "empty"],
    ["Lab", "uppercase"],
    ["my lab", "a space"],
    ["my_lab", "an underscore"],
    ["-lab", "a leading hyphen"],
    ["lab-", "a trailing hyphen"],
    ["my--lab", "a double hyphen"],
    ["lab.io", "a dot"],
  ])("refuses %s (%s)", (slug) => {
    expect(organizationSlugRejection(slug)).toBe(ORG_SLUG_FORMAT_MESSAGE);
  });

  it("refuses a slug longer than the column allows", () => {
    expect(organizationSlugRejection("a".repeat(ORG_SLUG_MAX_LENGTH + 1))).toBe(
      ORG_SLUG_FORMAT_MESSAGE,
    );
  });

  it("reserves the personal-workspace namespace", () => {
    // Well-formed, so it would sail past the format rule — and an organization in
    // this namespace is treated as a personal workspace everywhere afterwards:
    // no members, no invitations, no teams, and no way to delete it.
    expect(organizationSlugRejection("personal-lab")).toBe(ORG_SLUG_RESERVED_MESSAGE);
    expect(organizationSlugRejection("personal")).toBeNull();
  });
});

describe("canonical organization roles", () => {
  it("names exactly the roles the permission matrix defines", () => {
    // A role accepted here that the matrix does not know would be storable and
    // then read as no permissions at all; one the matrix knows but this refuses
    // would be unassignable.
    expect([...ORG_ROLES].sort()).toEqual(Object.keys(roles).sort());
  });

  it.each([...ORG_ROLES])("accepts %s", (role) => {
    expect(isCanonicalOrgRole(role)).toBe(true);
  });

  it.each([
    [" owner", "a leading space"],
    ["owner ", "a trailing space"],
    ["member, owner", "a comma list"],
    ["member,owner", "a comma list without spaces"],
    ["Owner", "the wrong case"],
    ["", "empty"],
    ["editor", "an unknown role"],
  ])("refuses %s (%s)", (role) => {
    // Better Auth stores these verbatim and its creator-role gate compares them
    // untrimmed, so a trimming reader would see an owner where it saw none.
    expect(isCanonicalOrgRole(role)).toBe(false);
  });

  it.each([[["member", " owner"]], [null], [undefined], [42]])(
    "refuses the non-string %s",
    (role) => {
      expect(isCanonicalOrgRole(role)).toBe(false);
    },
  );
});

describe("owner-role detection", () => {
  it.each([
    ["owner", true],
    ["member,owner", true],
    [" owner , admin ", true],
    ["admin", false],
    ["ownership", false],
    ["", false],
    [null, false],
    [undefined, false],
  ])("reads %s as %s", (role, expected) => {
    expect(isOwnerRole(role)).toBe(expected);
  });
});
