import { render, screen } from "@testing-library/react-native";
import i18next from "i18next";
import React from "react";
import { initReactI18next } from "react-i18next";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { OrganizationDirectoryEntry } from "@repo/api/domains/organization/organization.schema";

import { OrganizationCard } from "./organization-card";

// The sibling card test mocks `~/shared/i18n`, so only this one can catch a raw
// key reaching the screen.
vi.mock("~/shared/constants/colors", () => ({ colors: { jii: { darkGreen: "#004000" } } }));
vi.mock("~/shared/ui/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({ inactive: "#777777" }),
}));

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

const TYPE_LABELS: Record<string, string> = {
  research_institute: "Research institute",
  non_profit: "Non-profit",
  private_company: "Private company",
  government_agency: "Government agency",
  university: "University",
};

describe("OrganizationCard against the real translations", () => {
  it.each(Object.entries(TYPE_LABELS))("renders %s as its translated label", (type, label) => {
    render(
      <OrganizationCard
        organization={entry({ type: type as OrganizationDirectoryEntry["type"] })}
        onPress={vi.fn()}
      />,
    );

    expect(screen.getByText(`${label} · Utrecht · 12 members`)).toBeTruthy();
  });

  it("never leaves a raw i18n key on screen", () => {
    render(
      <OrganizationCard
        organization={entry({ visibility: "private", membershipStatus: "member" })}
        onPress={vi.fn()}
      />,
    );

    expect(screen.queryByText(/^(type|membership|memberCount)\./u)).toBeNull();
    expect(screen.queryByText(/type\.research_institute/u)).toBeNull();
  });
});
