import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OrganizationDirectoryEntry } from "@repo/api/domains/organization/organization.schema";

import { HomeDiscoverCard } from "./home-discover-card";

type OrganizationState =
  | { kind: "member" }
  | { kind: "pending"; organization: OrganizationDirectoryEntry }
  | { kind: "none" };

type ExperimentState = { kind: "member" } | { kind: "none" };

interface CardTestState {
  experimentState: ExperimentState | undefined;
  organizationState: OrganizationState | undefined;
  isOrganizationLoading: boolean;
  push: Mock<(href: unknown) => void>;
}

const state = vi.hoisted<CardTestState>(() => ({
  experimentState: { kind: "none" },
  organizationState: { kind: "none" },
  isOrganizationLoading: false,
  push: vi.fn<(href: unknown) => void>(),
}));

vi.mock("expo-router", () => ({ router: { push: (href: unknown) => state.push(href) } }));
vi.mock("~/features/experiments/hooks/use-experiment-onboarding-state", () => ({
  useExperimentOnboardingState: () => ({ state: state.experimentState }),
}));
vi.mock("~/features/organizations/hooks/use-organization-onboarding-state", () => ({
  useOrganizationOnboardingState: () => ({
    state: state.organizationState,
    isLoading: state.isOrganizationLoading,
  }),
}));
vi.mock("~/shared/ui/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({ brand: "#005e5e", inactive: "#9E9E9E" }),
}));
vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "discover.joinTitle": "Find something to join",
        "discover.joinSubtitle": "Public experiments and organizations, or enter a join code",
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
  state.experimentState = { kind: "none" };
  state.organizationState = { kind: "none" };
  state.isOrganizationLoading = false;
  state.push.mockClear();
});

describe("HomeDiscoverCard", () => {
  describe("renders nothing on an unknown", () => {
    it("while the related experiment list has not answered", () => {
      state.experimentState = undefined;

      expect(render(<HomeDiscoverCard />).toJSON()).toBeNull();
    });

    it("while the organization state has not answered", () => {
      state.organizationState = undefined;

      expect(render(<HomeDiscoverCard />).toJSON()).toBeNull();
    });

    it("while the organization directory is still loading", () => {
      state.isOrganizationLoading = true;

      expect(render(<HomeDiscoverCard />).toJSON()).toBeNull();
    });
  });

  describe("renders nothing for someone already measuring", () => {
    it("for an experiment member in no organization", () => {
      state.experimentState = { kind: "member" };
      state.organizationState = { kind: "none" };

      expect(render(<HomeDiscoverCard />).toJSON()).toBeNull();
    });

    it("for an experiment member with an organization request still pending", () => {
      state.experimentState = { kind: "member" };
      state.organizationState = { kind: "pending", organization: organization() };

      expect(render(<HomeDiscoverCard />).toJSON()).toBeNull();
    });
  });

  describe("request pending", () => {
    it("names the organization it is waiting on", () => {
      state.organizationState = { kind: "pending", organization: organization() };

      render(<HomeDiscoverCard />);

      expect(screen.getByText("Request pending")).toBeTruthy();
      expect(screen.getByText("Photosynthesis Lab Utrecht")).toBeTruthy();
      expect(screen.queryByText("Find something to join")).toBeNull();
    });

    it("opens that organization's detail screen, not the hub", () => {
      state.organizationState = {
        kind: "pending",
        organization: organization({ id: "org-42" }),
      };

      render(<HomeDiscoverCard />);
      fireEvent.press(screen.getByText("Request pending"));

      expect(state.push).toHaveBeenCalledWith({
        pathname: "/organizations/[id]",
        params: { id: "org-42" },
      });
    });
  });

  describe("nothing joined yet", () => {
    it("nudges towards the hub", () => {
      render(<HomeDiscoverCard />);

      expect(screen.getByText("Find something to join")).toBeTruthy();
      expect(
        screen.getByText("Public experiments and organizations, or enter a join code"),
      ).toBeTruthy();
    });

    it("opens the hub on tap", () => {
      render(<HomeDiscoverCard />);

      fireEvent.press(screen.getByText("Find something to join"));

      expect(state.push).toHaveBeenCalledWith("/discover");
    });

    it("still nudges an organization member who is in no experiment", () => {
      state.organizationState = { kind: "member" };

      render(<HomeDiscoverCard />);

      expect(screen.getByText("Find something to join")).toBeTruthy();
    });
  });
});
