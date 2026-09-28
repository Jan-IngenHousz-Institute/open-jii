import { fireEvent, render, screen } from "@testing-library/react-native";
import { FlaskConical } from "lucide-react-native";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Experiment } from "@repo/api/domains/experiment/experiment.schema";

import { ExperimentDetailScreen } from "./experiment-detail-screen";

interface AccessState {
  experiment: Experiment | undefined;
  membershipStatus: "none" | "pending_request" | "member" | undefined;
  isLoading: boolean;
  isPaused: boolean;
  error: unknown;
  isUnavailable: boolean;
  refetch: Mock<() => void>;
}

const state = vi.hoisted<AccessState>(() => ({
  experiment: undefined,
  membershipStatus: undefined,
  isLoading: false,
  isPaused: false,
  error: undefined,
  isUnavailable: false,
  refetch: vi.fn<() => void>(),
}));

vi.mock("expo-router", () => ({
  router: { back: vi.fn(), push: vi.fn() },
  useLocalSearchParams: () => ({ id: "exp-1" }),
  useNavigation: () => ({ setOptions: vi.fn() }),
}));
vi.mock("~/features/experiments/hooks/use-experiment-access", () => ({
  useExperimentAccess: () => state,
}));
vi.mock("~/features/experiments/components/experiment-join-cta", () => ({
  ExperimentJoinCta: () => <View testID="join-cta" />,
}));
vi.mock("~/shared/ui/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({ brand: "#005e5e", onSurface: "#121212", warningFg: "#92400e" }),
}));
vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    i18n: { language: "en-US" },
    t: (key: string, values?: { count?: number; name?: string }) => {
      if (key === "experiments:detail.by") return `by ${String(values?.name)}`;
      return (
        {
          "common:retry": "Retry",
          "common:back": "Back",
          "experiments:detail.title": "Experiment",
          "experiments:detail.unavailable": "This experiment isn't available",
          "experiments:detail.unavailableHint": "It may be private, or it may no longer exist.",
          "experiments:detail.offline": "You're offline. Connect to load this experiment.",
          "experiments:detail.loadFailed": "Could not load this experiment.",
          "experiments:detail.archived": "This experiment is archived",
          "experiments:detail.noDescription": "This experiment has not been described yet.",
          "experiments:detail.showMore": "Show more",
          "experiments:detail.showLess": "Show less",
          "experiments:detail.since": "On openJII since",
          "experiments:detail.collaboratorsLabel": "Collaborators",
          "experiments:status.stale": "Stale",
          "experiments:status.published": "Published",
          "experiments:status.archived": "Archived",
        }[key] ?? key
      );
    },
  }),
}));

const EXPERIMENT = {
  id: "exp-1",
  name: "Canopy Phi2 Sweep",
  description: "<p>Phi2 across the canopy profile.</p>",
  status: "active",
  visibility: "public",
  embargoUntil: "2027-01-01T00:00:00.000Z",
  anonymizeContributors: false,
  workbookId: "wb-1",
  workbookVersionId: "wv-1",
  organizationId: "org-1",
  organizationName: "Canopy Lab",
  createdBy: "user-1",
  membersCount: 6,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
} as unknown as Experiment;

beforeEach(() => {
  state.experiment = EXPERIMENT;
  state.membershipStatus = "member";
  state.isLoading = false;
  state.isPaused = false;
  state.error = undefined;
  state.isUnavailable = false;
  state.refetch.mockClear();
});

describe("ExperimentDetailScreen", () => {
  it("renders the experiment and its call to action", () => {
    render(<ExperimentDetailScreen />);

    expect(screen.getByText("Canopy Phi2 Sweep")).toBeTruthy();
    expect(screen.getByText("Canopy Lab")).toBeTruthy();
    expect(screen.getByText("Phi2 across the canopy profile.")).toBeTruthy();
    expect(screen.getByTestId("join-cta")).toBeTruthy();
  });

  it.each([
    ["a fresh 403", "member" as const],
    ["a fresh 404", "none" as const],
  ])("shows the dead end for %s even with an experiment still cached", (_label, membership) => {
    state.isUnavailable = true;
    state.membershipStatus = membership;
    state.error = Object.assign(new Error("gone"), { status: 404 });

    render(<ExperimentDetailScreen />);

    expect(screen.getByText("This experiment isn't available")).toBeTruthy();
    expect(screen.queryByText("Canopy Phi2 Sweep")).toBeNull();
    expect(screen.queryByTestId("join-cta")).toBeNull();
  });

  it("offers Retry on an offline cold load, not a spinner", () => {
    state.experiment = undefined;
    state.membershipStatus = undefined;
    state.isPaused = true;

    const { UNSAFE_queryAllByType } = render(<ExperimentDetailScreen />);

    expect(screen.getByText("You're offline. Connect to load this experiment.")).toBeTruthy();
    expect(UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);

    fireEvent.press(screen.getByText("Retry"));
    expect(state.refetch).toHaveBeenCalledOnce();
  });

  it("offers Retry on a failed cold load, with the generic wording", () => {
    state.experiment = undefined;
    state.membershipStatus = undefined;
    state.error = new Error("boom");

    render(<ExperimentDetailScreen />);

    expect(screen.getByText("Could not load this experiment.")).toBeTruthy();
    expect(screen.queryByText("You're offline. Connect to load this experiment.")).toBeNull();

    fireEvent.press(screen.getByText("Retry"));
    expect(state.refetch).toHaveBeenCalledOnce();
  });

  it("keeps rendering cached data through a network failure", () => {
    state.error = new Error("Network request failed");

    render(<ExperimentDetailScreen />);

    expect(screen.getByText("Canopy Phi2 Sweep")).toBeTruthy();
    expect(screen.queryByText("Could not load this experiment.")).toBeNull();
  });

  it("spins while the first read is still in flight", () => {
    state.experiment = undefined;
    state.membershipStatus = undefined;
    state.isLoading = true;

    const { UNSAFE_queryAllByType } = render(<ExperimentDetailScreen />);

    expect(UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(1);
  });

  it.each(["member", "pending_request", "none"] as const)(
    "replaces every action with the archived banner for a %s",
    (membership) => {
      state.experiment = { ...EXPERIMENT, status: "archived" };
      state.membershipStatus = membership;

      render(<ExperimentDetailScreen />);

      expect(screen.getByText("This experiment is archived")).toBeTruthy();
      expect(screen.queryByTestId("join-cta")).toBeNull();
    },
  );

  it("falls back to wording rather than an empty block when there is no description", () => {
    state.experiment = { ...EXPERIMENT, description: null };

    render(<ExperimentDetailScreen />);

    expect(screen.getByText("This experiment has not been described yet.")).toBeTruthy();
    expect(screen.queryByText("Show more")).toBeNull();
  });

  it("expands a long description on demand", () => {
    const long = "x".repeat(400);
    state.experiment = { ...EXPERIMENT, description: `<p>${long}</p>` };

    render(<ExperimentDetailScreen />);

    expect(screen.queryByText(long)).toBeNull();
    fireEvent.press(screen.getByText("Show more"));
    expect(screen.getByText(long)).toBeTruthy();
    expect(screen.getByText("Show less")).toBeTruthy();
  });
});

describe("ExperimentDetailScreen density", () => {
  it("carries the flask tile the organization detail has", () => {
    render(<ExperimentDetailScreen />);

    expect(screen.UNSAFE_getByType(FlaskConical)).toBeTruthy();
  });

  it("names the organization and the owner in one subtitle", () => {
    state.experiment = {
      ...EXPERIMENT,
      ownerFirstName: "Sofie",
      ownerLastName: "de Vries",
    };

    render(<ExperimentDetailScreen />);

    expect(screen.getByText("Canopy Lab · by Sofie de Vries")).toBeTruthy();
  });

  it("keeps the half of a name it has when the other is null", () => {
    state.experiment = {
      ...EXPERIMENT,
      ownerFirstName: "Sofie",
      ownerLastName: null,
    };

    render(<ExperimentDetailScreen />);

    expect(screen.getByText("Canopy Lab · by Sofie")).toBeTruthy();
  });

  it("drops the owner clause entirely when both names are null", () => {
    state.experiment = {
      ...EXPERIMENT,
      ownerFirstName: null,
      ownerLastName: null,
    };

    render(<ExperimentDetailScreen />);

    expect(screen.getByText("Canopy Lab")).toBeTruthy();
    expect(screen.queryByText(/ by /u)).toBeNull();
  });

  it("renders the since row from createdAt", () => {
    render(<ExperimentDetailScreen />);

    expect(screen.getByText("On openJII since")).toBeTruthy();
    expect(screen.getByText("January 2026")).toBeTruthy();
  });

  it("says nothing about since when createdAt is unparseable", () => {
    state.experiment = { ...EXPERIMENT, createdAt: "not-a-date" };

    render(<ExperimentDetailScreen />);

    expect(screen.queryByText("On openJII since")).toBeNull();
  });

  describe("the status tag", () => {
    it("says nothing for an active experiment", () => {
      render(<ExperimentDetailScreen />);

      expect(screen.queryByText("Stale")).toBeNull();
      expect(screen.queryByText("Published")).toBeNull();
    });

    it("tags a stale experiment beside the membership tag", () => {
      state.experiment = { ...EXPERIMENT, status: "stale" } as unknown as Experiment;

      render(<ExperimentDetailScreen />);

      expect(screen.getByText("Stale")).toBeTruthy();
    });
  });

  describe("the collaborators row", () => {
    it("reads as a label and a value, like the since row beneath it", () => {
      render(<ExperimentDetailScreen />);

      expect(screen.getByText("Collaborators")).toBeTruthy();
      expect(screen.getByText("6")).toBeTruthy();
    });

    it("renders nothing when the read carried no count", () => {
      state.experiment = { ...EXPERIMENT, membersCount: undefined };

      render(<ExperimentDetailScreen />);

      expect(screen.queryByText("Collaborators")).toBeNull();
    });

    it("shows a zero count, which is a real answer", () => {
      state.experiment = { ...EXPERIMENT, membersCount: 0 };

      render(<ExperimentDetailScreen />);

      expect(screen.getByText("Collaborators")).toBeTruthy();
      expect(screen.getByText("0")).toBeTruthy();
    });

    it("carries no stat tiles any more", () => {
      const { toJSON } = render(<ExperimentDetailScreen />);

      expect(JSON.stringify(toJSON())).not.toContain("bg-surface");
    });
  });
});
