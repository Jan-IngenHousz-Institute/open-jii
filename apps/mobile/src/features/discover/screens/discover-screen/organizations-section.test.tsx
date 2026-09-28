import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OrganizationDirectoryEntry } from "@repo/api/domains/organization/organization.schema";

import { OrganizationsSection } from "./organizations-section";

interface DirectoryState {
  organizations: OrganizationDirectoryEntry[] | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isPaused: boolean;
  error: unknown;
  isRefetching: boolean;
  refetch: Mock<() => void>;
}

const state = vi.hoisted<DirectoryState>(() => ({
  organizations: [],
  isLoading: false,
  isFetching: false,
  isPaused: false,
  error: undefined,
  isRefetching: false,
  refetch: vi.fn<() => void>(),
}));

const capturedArgs = vi.hoisted(() => [] as Record<string, unknown>[]);
const push = vi.hoisted(() => vi.fn<(href: unknown) => void>());

vi.mock("expo-router", () => ({ router: { push: (href: unknown) => push(href) } }));
vi.mock("~/features/organizations/hooks/use-organization-directory", () => ({
  useOrganizationDirectory: (args: Record<string, unknown>) => {
    capturedArgs.push(args);
    return state;
  },
}));
vi.mock("~/shared/ui/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({ brand: "#005e5e", inactive: "#777777" }),
}));
vi.mock("~/shared/constants/colors", () => ({ colors: { jii: { darkGreen: "#004000" } } }));
vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { count?: number }) => {
      if (key === "memberCount") return `${String(values?.count)} members`;
      return (
        {
          "common:retry": "Retry",
          "organizations:loading": "Loading organizations…",
          "organizations:offline": "You're offline. Connect to load organizations.",
          "organizations:loadFailed": "Could not load organizations.",
          "search.noResults": "No organizations match",
          empty: "No organizations yet",
          "membership.member": "Joined",
          "membership.requested": "Requested",
          "membership.private": "Private",
          "organizations:type.university": "University",
        }[key] ?? key
      );
    },
  }),
}));

function entry(overrides: Partial<OrganizationDirectoryEntry> = {}): OrganizationDirectoryEntry {
  return {
    id: "org-1",
    name: "Canopy Lab",
    slug: "canopy-lab",
    logo: null,
    type: "university",
    description: null,
    location: "Utrecht",
    memberCount: 12,
    resourceCount: 3,
    visibility: "public",
    membershipStatus: "none",
    ...overrides,
  };
}

function renderSection(props: Partial<React.ComponentProps<typeof OrganizationsSection>> = {}) {
  return render(<OrganizationsSection search="" enabled onStatusChange={vi.fn()} {...props} />);
}

beforeEach(() => {
  state.organizations = [entry()];
  state.isLoading = false;
  state.isFetching = false;
  state.isPaused = false;
  state.error = undefined;
  state.isRefetching = false;
  state.refetch.mockClear();
  capturedArgs.length = 0;
  push.mockClear();
});

describe("OrganizationsSection", () => {
  it("passes the hub's term and enabled flag straight to the directory hook", () => {
    renderSection({ search: "canopy", enabled: false });

    expect(capturedArgs[0]).toEqual({ search: "canopy", enabled: false });
  });

  it("shows the loading copy while the first page is in flight", () => {
    state.isLoading = true;
    state.organizations = undefined;

    renderSection();

    expect(screen.getByText("Loading organizations…")).toBeTruthy();
  });

  it("says offline, not failed, when the cold load paused with no error", () => {
    state.organizations = undefined;
    state.isPaused = true;

    renderSection();

    expect(screen.getByText("You're offline. Connect to load organizations.")).toBeTruthy();
    expect(screen.queryByText("Could not load organizations.")).toBeNull();
    expect(screen.getByText("Retry")).toBeTruthy();
  });

  it("says failed when there is a real error, even while paused", () => {
    state.organizations = undefined;
    state.isPaused = true;
    state.error = new Error("boom");

    renderSection();

    expect(screen.getByText("Could not load organizations.")).toBeTruthy();
    expect(screen.queryByText("You're offline. Connect to load organizations.")).toBeNull();
  });

  it("reports a failure that arrived with an empty list", () => {
    state.organizations = [];
    state.error = new Error("boom");

    renderSection();

    expect(screen.getByText("Could not load organizations.")).toBeTruthy();
  });

  it("keeps rendering cached rows through a refetch failure", () => {
    state.error = new Error("boom");

    renderSection();

    expect(screen.getByText("Canopy Lab")).toBeTruthy();
    expect(screen.queryByText("Could not load organizations.")).toBeNull();
  });

  it("retries on demand from the failure state", () => {
    state.organizations = undefined;

    renderSection();
    fireEvent.press(screen.getByText("Retry"));

    expect(state.refetch).toHaveBeenCalledTimes(1);
  });

  it("renders a row per organization", () => {
    state.organizations = [entry(), entry({ id: "org-2", name: "Vallei Institute" })];

    renderSection();

    expect(screen.getByText("Canopy Lab")).toBeTruthy();
    expect(screen.getByText("Vallei Institute")).toBeTruthy();
  });

  it("opens the organization detail, not the discover detail, on a row tap", () => {
    renderSection();

    fireEvent.press(screen.getByText("Canopy Lab"));

    expect(push).toHaveBeenCalledWith({
      pathname: "/organizations/[id]",
      params: { id: "org-1" },
    });
  });

  it("blames the term when a search came back empty", () => {
    state.organizations = [];

    renderSection({ search: "zzz" });

    expect(screen.getByText("No organizations match")).toBeTruthy();
  });

  it("says the directory is empty when there is no term", () => {
    state.organizations = [];

    renderSection({ search: "" });

    expect(screen.getByText("No organizations yet")).toBeTruthy();
  });

  it("treats a whitespace-only term as no term at all", () => {
    state.organizations = [];

    renderSection({ search: "   " });

    expect(screen.getByText("No organizations yet")).toBeTruthy();
  });

  it("reports its row count and fetching state up to the hub's search field", () => {
    const onStatusChange = vi.fn();
    state.organizations = [entry(), entry({ id: "org-2" })];
    state.isFetching = true;

    renderSection({ onStatusChange });

    expect(onStatusChange).toHaveBeenCalledWith({ count: 2, isFetching: true });
  });

  it("reports zero while nothing has come back yet", () => {
    const onStatusChange = vi.fn();
    state.organizations = undefined;

    renderSection({ onStatusChange });

    expect(onStatusChange).toHaveBeenCalledWith({ count: 0, isFetching: false });
  });

  it("carries no join-code row: codes are experiment-only", () => {
    renderSection();

    expect(screen.queryByText("Have a join code?")).toBeNull();
  });
});
