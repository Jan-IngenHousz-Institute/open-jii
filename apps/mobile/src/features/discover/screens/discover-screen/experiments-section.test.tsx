import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { FlatList, View } from "react-native";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExperimentListItem } from "@repo/api/domains/experiment/experiment.schema";

import { ExperimentsSection } from "./experiments-section";

interface DiscoverState {
  experiments: ExperimentListItem[] | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isPaused: boolean;
  error: unknown;
  isRefetching: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  refetch: Mock<() => void>;
  fetchNextPage: Mock<() => void>;
}

const state = vi.hoisted<DiscoverState>(() => ({
  experiments: [],
  isLoading: false,
  isFetching: false,
  isPaused: false,
  error: undefined,
  isRefetching: false,
  isFetchingNextPage: false,
  hasNextPage: false,
  refetch: vi.fn<() => void>(),
  fetchNextPage: vi.fn<() => void>(),
}));

const capturedArgs = vi.hoisted(() => [] as Record<string, unknown>[]);
const push = vi.hoisted(() => vi.fn<(href: unknown) => void>());
const openSheet = vi.hoisted(() => vi.fn<() => void>());

vi.mock("expo-router", () => ({ router: { push: (href: unknown) => push(href) } }));
vi.mock("~/features/experiments/hooks/use-discover-experiments", () => ({
  useDiscoverExperiments: (args: Record<string, unknown>) => {
    capturedArgs.push(args);
    return state;
  },
}));
vi.mock("~/features/experiments/hooks/use-join-code-entry-sheet", () => ({
  useJoinCodeEntrySheet: () => ({ open: openSheet, sheet: <View testID="code-sheet" /> }),
}));
vi.mock("~/shared/ui/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({ brand: "#005e5e", inactive: "#777777" }),
}));
vi.mock("~/shared/constants/colors", () => ({ colors: { jii: { darkGreen: "#004000" } } }));
vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { count?: number }) => {
      if (key === "discover:collaborators") return `${String(values?.count)} collaborators`;
      return (
        {
          "common:retry": "Retry",
          "discover:loading": "Loading experiments…",
          "discover:offline": "You're offline. Connect to find experiments.",
          "discover:loadFailed": "Could not load experiments.",
          "discover:haveCode": "Have a join code?",
          "discover:haveCodeHint": "Enter it or scan the QR from your organizer",
          "search.noResults": "No experiments match",
          empty: "No public experiments yet",
        }[key] ?? key
      );
    },
  }),
}));

function entry(overrides: Partial<ExperimentListItem> = {}): ExperimentListItem {
  return {
    id: "exp-1",
    name: "Canopy Phi2 Sweep",
    organizationName: "Canopy Lab",
    membersCount: 6,
    membershipStatus: "none",
    ...overrides,
  } as ExperimentListItem;
}

function renderSection(props: Partial<React.ComponentProps<typeof ExperimentsSection>> = {}) {
  return render(<ExperimentsSection search="" enabled onStatusChange={vi.fn()} {...props} />);
}

beforeEach(() => {
  state.experiments = [entry()];
  state.isLoading = false;
  state.isFetching = false;
  state.isPaused = false;
  state.error = undefined;
  state.isRefetching = false;
  state.isFetchingNextPage = false;
  state.hasNextPage = false;
  state.refetch.mockClear();
  state.fetchNextPage.mockClear();
  capturedArgs.length = 0;
  push.mockClear();
  openSheet.mockClear();
});

describe("ExperimentsSection", () => {
  it("passes the hub's term and enabled flag straight to the discover hook", () => {
    renderSection({ search: "canopy", enabled: false });

    expect(capturedArgs[0]).toEqual({ search: "canopy", enabled: false });
  });

  describe("the join-code row", () => {
    it("is first on screen, above the list", () => {
      renderSection();

      expect(screen.getByText("Have a join code?")).toBeTruthy();
      expect(screen.getByText("Enter it or scan the QR from your organizer")).toBeTruthy();
    });

    it("opens the entry sheet on tap", () => {
      renderSection();

      fireEvent.press(screen.getByText("Have a join code?"));

      expect(openSheet).toHaveBeenCalledTimes(1);
      expect(push).not.toHaveBeenCalled();
    });

    it("stays reachable while the first page is still loading", () => {
      state.isLoading = true;
      state.experiments = undefined;

      renderSection();

      expect(screen.getByText("Have a join code?")).toBeTruthy();
      expect(screen.getByText("Loading experiments…")).toBeTruthy();
    });

    it("stays reachable in the offline state, which is when a code matters most", () => {
      state.experiments = undefined;
      state.isPaused = true;

      renderSection();

      expect(screen.getByText("Have a join code?")).toBeTruthy();
      expect(screen.getByText("You're offline. Connect to find experiments.")).toBeTruthy();
    });
  });

  it("says offline, not failed, when the cold load paused with no error", () => {
    state.experiments = undefined;
    state.isPaused = true;

    renderSection();

    expect(screen.getByText("You're offline. Connect to find experiments.")).toBeTruthy();
    expect(screen.queryByText("Could not load experiments.")).toBeNull();
    expect(screen.getByText("Retry")).toBeTruthy();
  });

  it("says failed when there is a real error, even while paused", () => {
    state.experiments = undefined;
    state.isPaused = true;
    state.error = new Error("boom");

    renderSection();

    expect(screen.getByText("Could not load experiments.")).toBeTruthy();
  });

  it("keeps rendering cached rows through a refetch failure", () => {
    state.error = new Error("boom");

    renderSection();

    expect(screen.getByText("Canopy Phi2 Sweep")).toBeTruthy();
    expect(screen.queryByText("Could not load experiments.")).toBeNull();
  });

  it("retries on demand from the failure state", () => {
    state.experiments = undefined;

    renderSection();
    fireEvent.press(screen.getByText("Retry"));

    expect(state.refetch).toHaveBeenCalledTimes(1);
  });

  it("opens the discover detail on a row tap", () => {
    renderSection();

    fireEvent.press(screen.getByText("Canopy Phi2 Sweep"));

    expect(push).toHaveBeenCalledWith({ pathname: "/discover/[id]", params: { id: "exp-1" } });
  });

  it("blames the term when a search came back empty", () => {
    state.experiments = [];

    renderSection({ search: "zzz" });

    expect(screen.getByText("No experiments match")).toBeTruthy();
  });

  it("says the directory is empty when there is no term", () => {
    state.experiments = [];

    renderSection({ search: "" });

    expect(screen.getByText("No public experiments yet")).toBeTruthy();
  });

  describe("pagination", () => {
    it("asks for the next page when the list reaches its end", () => {
      state.hasNextPage = true;

      const { UNSAFE_getByType } = renderSection();
      UNSAFE_getByType(FlatList).props.onEndReached();

      expect(state.fetchNextPage).toHaveBeenCalledTimes(1);
    });

    it("asks for nothing when the server said there is no next page", () => {
      state.hasNextPage = false;

      const { UNSAFE_getByType } = renderSection();
      UNSAFE_getByType(FlatList).props.onEndReached();

      expect(state.fetchNextPage).not.toHaveBeenCalled();
    });

    it("does not stack a second request while one page is already in flight", () => {
      state.hasNextPage = true;
      state.isFetchingNextPage = true;

      const { UNSAFE_getByType } = renderSection();
      UNSAFE_getByType(FlatList).props.onEndReached();

      expect(state.fetchNextPage).not.toHaveBeenCalled();
    });
  });

  it("reports its row count and fetching state up to the hub's search field", () => {
    const onStatusChange = vi.fn();
    state.experiments = [entry(), entry({ id: "exp-2" })];
    state.isFetching = true;

    renderSection({ onStatusChange });

    expect(onStatusChange).toHaveBeenCalledWith({ count: 2, isFetching: true });
  });

  it("reports zero while nothing has come back yet", () => {
    const onStatusChange = vi.fn();
    state.experiments = undefined;

    renderSection({ onStatusChange });

    expect(onStatusChange).toHaveBeenCalledWith({ count: 0, isFetching: false });
  });
});
