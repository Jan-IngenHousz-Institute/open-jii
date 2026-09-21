import { describe, expect, it } from "vitest";
import enUS from "~/shared/i18n/locales/en-US/organizations.json";
import nlNL from "~/shared/i18n/locales/nl-NL/organizations.json";

import { zOrganizationType } from "@repo/api/domains/organization/organization.schema";

import { organizationTypeLabelKey } from "./organization-type-label";

function hasKey(bundle: Record<string, unknown>, path: string): boolean {
  const value = path.split(".").reduce<unknown>((node, segment) => {
    return node && typeof node === "object"
      ? (node as Record<string, unknown>)[segment]
      : undefined;
  }, bundle);
  return typeof value === "string" && value.length > 0;
}

describe("organizationTypeLabelKey", () => {
  it("returns null for a missing type", () => {
    expect(organizationTypeLabelKey(null)).toBeNull();
  });

  it.each(zOrganizationType.options)("qualifies %s with the organizations namespace", (type) => {
    expect(organizationTypeLabelKey(type)).toMatch(/^organizations:type\./u);
  });

  it.each(zOrganizationType.options)("has a translation for %s in both locales", (type) => {
    const path = (organizationTypeLabelKey(type) ?? "").replace(/^organizations:/u, "");

    expect(hasKey(enUS, path)).toBe(true);
    expect(hasKey(nlNL, path)).toBe(true);
  });
});
