import { render, screen } from "@testing-library/react-native";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OrganizationProfile } from "@repo/api/domains/organization/organization.schema";

import { OrganizationDetailScreen } from "./organization-detail-screen";

const state = vi.hoisted(() => ({ organization: undefined as OrganizationProfile | undefined }));

vi.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "org-1" }),
  useNavigation: () => ({ setOptions: vi.fn() }),
}));
vi.mock("~/features/organizations/hooks/use-organization", () => ({
  useOrganization: () => ({
    organization: state.organization,
    isLoading: false,
    isPaused: false,
    error: undefined,
    isNotFound: false,
    refetch: vi.fn(),
  }),
}));
vi.mock("~/features/organizations/components/organization-join-cta", async () => {
  const { Text } = await import("react-native");
  return { OrganizationJoinCta: () => <Text>join-cta</Text> };
});
vi.mock("~/features/organizations/components/organization-open-on-web-button", () => ({
  OrganizationOpenOnWebButton: () => null,
}));
vi.mock("~/shared/ui/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({ brand: "#005e5e", inactive: "#777777", onSurface: "#000000" }),
}));
vi.mock("~/shared/constants/colors", () => ({ colors: { jii: { darkGreen: "#004000" } } }));
vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US" },
  }),
}));

function profile(overrides: Partial<OrganizationProfile> = {}): OrganizationProfile {
  return {
    id: "org-1",
    name: "Canopy Lab",
    slug: "canopy-lab",
    logo: null,
    type: "university",
    description: null,
    website: null,
    location: null,
    visibility: "public",
    memberCount: 3,
    resourceCount: 2,
    createdAt: "2024-03-04T09:00:00.000Z",
    role: null,
    membershipStatus: "none",
    ...overrides,
  };
}

describe("OrganizationDetailScreen", () => {
  beforeEach(() => {
    state.organization = profile();
  });

  it("offers a join request for an ordinary public organization", () => {
    render(<OrganizationDetailScreen />);

    expect(screen.getByText("join-cta")).toBeTruthy();
  });

  it("offers none for a Demo organization, which takes no join requests", () => {
    state.organization = profile({ type: "demo" });

    render(<OrganizationDetailScreen />);

    expect(screen.getByText("Canopy Lab")).toBeTruthy();
    expect(screen.queryByText("join-cta")).toBeNull();
  });
});
