import { describe, expect, it } from "vitest";

import {
  ORG_SLUG_MAX_LENGTH,
  organizationSlugRejection,
  suggestOrganizationSlug,
} from "./organization-slug";

describe("organizationSlugRejection", () => {
  it.each(["openjii", "jan-ingenhousz-institute", "lab2", "a"])("accepts %s", (slug) => {
    expect(organizationSlugRejection(slug)).toBeNull();
  });

  it("tells an empty field apart from a malformed one", () => {
    expect(organizationSlugRejection("")).toBe("required");
  });

  it.each([
    ["OpenJII", "uppercase"],
    ["open jii", "a space"],
    ["open_jii", "an underscore"],
    ["-openjii", "a leading hyphen"],
    ["openjii-", "a trailing hyphen"],
    ["open--jii", "a doubled hyphen"],
    ["openjii!", "punctuation"],
    ["üni", "a non-ASCII letter"],
  ])("rejects %s (%s)", (slug) => {
    expect(organizationSlugRejection(slug)).toBe("format");
  });

  it("rejects a slug past the column's width", () => {
    expect(organizationSlugRejection("a".repeat(ORG_SLUG_MAX_LENGTH))).toBeNull();
    expect(organizationSlugRejection("a".repeat(ORG_SLUG_MAX_LENGTH + 1))).toBe("tooLong");
  });

  // The server's check-slug endpoint answers uniqueness only and bypasses the
  // guard that owns this rule, so the client is the first place it is enforced.
  it.each(["personal-abc", "personal-00000000-0000-0000-0000-000000000000"])(
    "reports %s as reserved rather than as a format problem",
    (slug) => {
      expect(organizationSlugRejection(slug)).toBe("reserved");
    },
  );

  // Format before namespace, in the same order the server checks them, so both
  // sides give the same reason for a slug that breaks both rules.
  it("reports a bare prefix as malformed, as the server does", () => {
    expect(organizationSlugRejection("personal-")).toBe("format");
  });

  it("does not reserve a slug that merely starts with the word", () => {
    expect(organizationSlugRejection("personalised-lab")).toBeNull();
  });
});

describe("suggestOrganizationSlug", () => {
  it.each([
    ["Jan IngenHousz Institute", "jan-ingenhousz-institute"],
    ["Universität Basel", "universitat-basel"],
    ["  Leading & trailing  ", "leading-trailing"],
    ["Lab #2 (North)", "lab-2-north"],
  ])("turns %s into %s", (name, expected) => {
    expect(suggestOrganizationSlug(name)).toBe(expected);
  });

  it("suggests nothing rather than an invalid slug when a name has no usable characters", () => {
    expect(suggestOrganizationSlug("!!!")).toBe("");
  });

  it("only ever suggests slugs the rule accepts", () => {
    for (const name of ["Jan IngenHousz Institute", "Lab #2 (North)", "A".repeat(300)]) {
      const suggestion = suggestOrganizationSlug(name);
      if (suggestion.length > 0) expect(organizationSlugRejection(suggestion)).toBeNull();
    }
  });
});
