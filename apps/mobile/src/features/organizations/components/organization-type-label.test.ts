import { renderHook } from "@testing-library/react-native";
import i18next from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import { beforeAll, describe, expect, it } from "vitest";

import { zOrganizationType } from "@repo/api/domains/organization/organization.schema";

import { organizationTypeLabelKey } from "./organization-type-label";

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

describe("organizationTypeLabelKey", () => {
  it("returns null for a missing type", () => {
    expect(organizationTypeLabelKey(null)).toBeNull();
  });

  it.each(zOrganizationType.options)(
    "resolves %s from a multi-namespace useTranslation (detail screen shape)",
    (type) => {
      const { result } = renderHook(() => useTranslation(["common", "organizations"]));
      const key = organizationTypeLabelKey(type) ?? "";

      expect(key).not.toBe("");
      const label = result.current.t(key);
      expect(label).not.toMatch(/type\./u);
      expect(label.length).toBeGreaterThan(0);
    },
  );

  it.each(zOrganizationType.options)(
    "resolves %s from the single organizations namespace (card shape)",
    (type) => {
      const { result } = renderHook(() => useTranslation("organizations"));
      const label = result.current.t(organizationTypeLabelKey(type) ?? "");

      expect(label).not.toMatch(/type\./u);
    },
  );
});
