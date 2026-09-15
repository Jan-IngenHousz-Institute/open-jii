import { renderHook } from "@testing-library/react-native";
import i18next from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import { beforeAll, describe, expect, it } from "vitest";

import { zOrganizationRole } from "@repo/api/domains/organization/organization.schema";

import { organizationRoleLabelKey } from "./organization-role-label";

beforeAll(async () => {
  const [{ default: commonEn }, { default: organizationsEn }] = await Promise.all([
    import("~/shared/i18n/locales/en-US/common.json"),
    import("~/shared/i18n/locales/en-US/organizations.json"),
  ]);

  await i18next.use(initReactI18next).init({
    lng: "en-US",
    fallbackLng: "en-US",
    ns: ["common", "organizations"],
    defaultNS: "common",
    resources: { "en-US": { common: commonEn, organizations: organizationsEn } },
    interpolation: { escapeValue: false },
    compatibilityJSON: "v4",
    returnNull: false,
  });
});

describe("organizationRoleLabelKey", () => {
  it.each(zOrganizationRole.options)(
    "resolves %s from a multi-namespace useTranslation (detail screen shape)",
    (role) => {
      const { result } = renderHook(() => useTranslation(["common", "organizations"]));

      const label = result.current.t(organizationRoleLabelKey(role));

      expect(label).not.toMatch(/role\./u);
      expect(label.length).toBeGreaterThan(0);
    },
  );

  it("falls back to the plain role word when the server sent no role", () => {
    const { result } = renderHook(() => useTranslation(["common", "organizations"]));

    expect(organizationRoleLabelKey(null)).toBe("organizations:role.member");
    expect(result.current.t(organizationRoleLabelKey(null))).toBe("Member");
  });

  it("names each role distinctly", () => {
    const { result } = renderHook(() => useTranslation(["common", "organizations"]));
    const labels = zOrganizationRole.options.map((role) =>
      result.current.t(organizationRoleLabelKey(role)),
    );

    expect(labels).toEqual(["Owner", "Admin", "Member"]);
  });
});
