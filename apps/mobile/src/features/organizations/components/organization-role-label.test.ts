import { describe, expect, it } from "vitest";
import enUS from "~/shared/i18n/locales/en-US/organizations.json";
import nlNL from "~/shared/i18n/locales/nl-NL/organizations.json";

import { zOrganizationRole } from "@repo/api/domains/organization/organization.schema";

import { organizationRoleLabelKey } from "./organization-role-label";

function hasKey(bundle: Record<string, unknown>, path: string): boolean {
  const value = path.split(".").reduce<unknown>((node, segment) => {
    return node && typeof node === "object"
      ? (node as Record<string, unknown>)[segment]
      : undefined;
  }, bundle);
  return typeof value === "string" && value.length > 0;
}

describe("organizationRoleLabelKey", () => {
  it.each(zOrganizationRole.options)("qualifies %s with the organizations namespace", (role) => {
    expect(organizationRoleLabelKey(role)).toBe(`organizations:role.${role}`);
  });

  it("falls back to the member key when the server sent no role", () => {
    expect(organizationRoleLabelKey(null)).toBe("organizations:role.member");
  });

  it.each(zOrganizationRole.options)("has a translation for %s in both locales", (role) => {
    const path = organizationRoleLabelKey(role).replace(/^organizations:/u, "");

    expect(hasKey(enUS, path)).toBe(true);
    expect(hasKey(nlNL, path)).toBe(true);
  });
});
