import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OrganizationDirectoryEntry } from "@repo/api/domains/organization/organization.schema";

import { HomeOrganizationsCard } from "./home-organizations-card";

type OnboardingState =
  | { kind: "member" }
  | { kind: "pending"; organization: OrganizationDirectoryEntry }
  | { kind: "none" };

interface CardTestState {
  state: OnboardingState | undefined;
  isLoading: boolean;
  push: Mock<(href: unknown) => void>;
}

const state = vi.hoisted<CardTestState>(() => ({
  state: { kind: "none" },
  isLoading: false,
  push: vi.fn<(href: unknown) => void>(),
}));

vi.mock("expo-router", () => ({ router: { push: (href: unknown) => state.push(href) } }));
vi.mock("~/features/organizations/hooks/use-organization-onboarding-state", () => ({
  useOrganizationOnboardingState: () => ({ state: state.state, isLoading: state.isLoading }),
}));
vi.mock("~/shared/ui/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({ brand: "#005e5e", inactive: "#9E9E9E" }),
}));
vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "organizations.joinTitle": "Join your organization",
        "organizations.joinSubtitle": "Find your school or lab and request access",
        "organizations.pendingTitle": "Request pending",
      })[key] ?? key,
  }),
}));

function organization(
  overrides: Partial<OrganizationDirectoryEntry> = {},
): OrganizationDirectoryEntry {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Photosynthesis Lab Utrecht",
    slug: null,
    logo: null,
    type: null,
    description: null,
    location: null,
    memberCount: 12,
    resourceCount: 0,
    visibility: "public",
    membershipStatus: "pending_request",
    ...overrides,
  };
}

beforeEach(() => {
  state.state = { kind: "none" };
  state.isLoading = false;
  state.push.mockClear();
});

describe("HomeOrganizationsCard", () => {
  it("renders nothing while the directory is still loading", () => {
    state.isLoading = true;

    const { toJSON } = render(<HomeOrganizationsCard />);

    expect(toJSON()).toBeNull();
  });

  it("renders nothing before the directory has answered at all", () => {
    state.state = undefined;

    const { toJSON } = render(<HomeOrganizationsCard />);

    expect(toJSON()).toBeNull();
  });

  it("renders nothing for someone already in an organization", () => {
    state.state = { kind: "member" };

    const { toJSON } = render(<HomeOrganizationsCard />);

    expect(toJSON()).toBeNull();
  });

  it("stays hidden for a member even before loading settles", () => {
    state.state = { kind: "member" };
    state.isLoading = true;

    const { toJSON } = render(<HomeOrganizationsCard />);

    expect(toJSON()).toBeNull();
  });

  describe("no organization yet", () => {
    it("nudges towards the directory", () => {
      render(<HomeOrganizationsCard />);

      expect(screen.getByText("Join your organization")).toBeTruthy();
      expect(screen.getByText("Find your school or lab and request access")).toBeTruthy();
    });

    it("opens the directory on tap", () => {
      render(<HomeOrganizationsCard />);

      fireEvent.press(screen.getByText("Join your organization"));

      expect(state.push).toHaveBeenCalledWith("/organizations");
    });
  });

  describe("request pending", () => {
    it("names the organization it is waiting on", () => {
      state.state = { kind: "pending", organization: organization() };

      render(<HomeOrganizationsCard />);

      expect(screen.getByText("Request pending")).toBeTruthy();
      expect(screen.getByText("Photosynthesis Lab Utrecht")).toBeTruthy();
      expect(screen.queryByText("Join your organization")).toBeNull();
    });

    it("opens that organization's detail screen, not the directory", () => {
      state.state = { kind: "pending", organization: organization({ id: "org-42" }) };

      render(<HomeOrganizationsCard />);

      fireEvent.press(screen.getByText("Request pending"));

      expect(state.push).toHaveBeenCalledWith({
        pathname: "/organizations/[id]",
        params: { id: "org-42" },
      });
    });
  });
});
