import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { View } from "react-native";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ExperimentSelectionStep } from "./experiment-selection-step";

interface PickerState {
  selectedExperimentId: string | undefined;
  flowError: unknown;
  options: { value: string; label: string }[];
  rows: { id: string }[] | undefined;
  isLoading: boolean;
  isPaused: boolean;
  error: unknown;
  push: Mock<(href: unknown) => void>;
}

const state = vi.hoisted<PickerState>(() => ({
  selectedExperimentId: "exp-1",
  flowError: undefined,
  options: [{ value: "exp-1", label: "Canopy Phi2 Sweep" }],
  rows: [{ id: "exp-1" }],
  isLoading: false,
  isPaused: false,
  error: undefined,
  push: vi.fn<(href: unknown) => void>(),
}));

vi.mock("expo-router", () => ({ router: { push: (href: unknown) => state.push(href) } }));
vi.mock("~/features/connection/hooks/use-device-connection", () => ({
  useConnectedDevice: () => ({ data: undefined }),
}));
vi.mock("~/features/connection/stores/use-device-sheet-store", () => ({
  useDeviceSheetStore: { getState: () => ({ open: vi.fn() }) },
}));
vi.mock("~/features/experiments/hooks/use-experiments", () => ({
  useExperiments: () => ({
    experiments: state.options,
    rows: state.rows,
    isLoading: state.isLoading,
    isPaused: state.isPaused,
    error: state.error,
    refetch: vi.fn(),
    isRefetching: false,
  }),
}));
vi.mock("~/features/experiments/hooks/use-precached-experiment-data", () => ({
  usePrecachedExperimentData: () => ({ data: undefined }),
}));
vi.mock("~/features/experiments/hooks/use-recent-experiment-activity", () => ({
  useRecentExperimentActivity: () => ({}),
}));
vi.mock("~/features/experiments/stores/use-experiment-selection-store", () => ({
  useExperimentSelectionStore: () => ({
    selectedExperimentId: state.selectedExperimentId,
    setSelectedExperimentId: vi.fn(),
  }),
}));
vi.mock("~/features/measurement-flow/hooks/use-experiments-flow-meta", () => ({
  useExperimentsFlowMeta: () => ({}),
}));
vi.mock("~/features/measurement-flow/hooks/use-load-experiment-flow", () => ({
  useLoadExperimentFlow: () => ({ isLoading: false, error: state.flowError, isReady: false }),
}));
vi.mock("~/features/measurement-flow/stores/use-flow-answers-store", () => ({
  useFlowAnswersStore: () => ({ clearHistory: vi.fn() }),
}));
vi.mock("~/features/measurement-flow/stores/use-measurement-flow-store", () => ({
  useMeasurementFlowStore: (selector: (s: { setExperimentId: () => void }) => unknown) =>
    selector({ setExperimentId: vi.fn() }),
}));
vi.mock("./experiment-card", () => ({ ExperimentCard: () => <View testID="experiment-card" /> }));
vi.mock("./offline-mode-indicator", () => ({ OfflineModeIndicator: () => null }));
vi.mock("~/shared/ui/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({ brand: "#005e5e", inactive: "#777777", onSurface: "#121212" }),
}));
vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "measurementFlow:flowStates.error": "Failed to load experiment. Please try again.",
        "experiments:detail.workbookNotShared":
          "This experiment's workbook isn't shared with you. Ask the organizer to make it public.",
        "measurementFlow:picker.emptyTitle": "You're not in any experiment yet",
        "measurementFlow:picker.emptyAction": "Find experiments",
      })[key] ?? key,
  }),
}));

function apiError(status: number) {
  return Object.assign(new Error(`status ${status}`), { status });
}

const NOT_SHARED =
  "This experiment's workbook isn't shared with you. Ask the organizer to make it public.";
const GENERIC = "Failed to load experiment. Please try again.";

const EMPTY_PROMPT = "You're not in any experiment yet";

beforeEach(() => {
  state.selectedExperimentId = "exp-1";
  state.flowError = undefined;
  state.options = [{ value: "exp-1", label: "Canopy Phi2 Sweep" }];
  state.rows = [{ id: "exp-1" }];
  state.isLoading = false;
  state.isPaused = false;
  state.error = undefined;
  state.push.mockClear();
});

describe("ExperimentSelectionStep empty prompt", () => {
  function emptyResponse() {
    state.options = [];
    state.rows = [];
    state.selectedExperimentId = undefined;
  }

  it("prompts only once a response actually came back empty", () => {
    emptyResponse();

    render(<ExperimentSelectionStep />);

    expect(screen.getByText(EMPTY_PROMPT)).toBeTruthy();
    expect(screen.getByText("Find experiments")).toBeTruthy();
  });

  it("sends the student to the hub", () => {
    emptyResponse();

    render(<ExperimentSelectionStep />);
    fireEvent.press(screen.getByText("Find experiments"));

    expect(state.push).toHaveBeenCalledWith("/discover");
  });

  it("says nothing while the first fetch is still running", () => {
    emptyResponse();
    state.rows = undefined;
    state.isLoading = true;

    render(<ExperimentSelectionStep />);

    expect(screen.queryByText(EMPTY_PROMPT)).toBeNull();
  });

  it("says nothing on a cold offline load, where the list is unknown, not empty", () => {
    emptyResponse();
    state.rows = undefined;
    state.isPaused = true;

    render(<ExperimentSelectionStep />);

    expect(screen.queryByText(EMPTY_PROMPT)).toBeNull();
  });

  it("says nothing when the read failed", () => {
    emptyResponse();
    state.error = new Error("boom");

    render(<ExperimentSelectionStep />);

    expect(screen.queryByText(EMPTY_PROMPT)).toBeNull();
  });

  it("says nothing when it is the local filter that emptied the list", () => {
    render(<ExperimentSelectionStep />);

    fireEvent.changeText(
      screen.getByPlaceholderText("experimentSelection.searchPlaceholder"),
      "zz",
    );

    expect(screen.queryByText(EMPTY_PROMPT)).toBeNull();
  });

  it("says nothing for someone who is in an experiment", () => {
    render(<ExperimentSelectionStep />);

    expect(screen.queryByText(EMPTY_PROMPT)).toBeNull();
  });
});

describe("ExperimentSelectionStep flow-load failures", () => {
  it("names the private workbook behind a public experiment when the read is refused", () => {
    state.flowError = apiError(403);

    render(<ExperimentSelectionStep />);

    expect(screen.getByText(NOT_SHARED)).toBeTruthy();
    expect(screen.queryByText(GENERIC)).toBeNull();
  });

  it.each([404, 500])("keeps the generic copy for a %i", (status) => {
    state.flowError = apiError(status);

    render(<ExperimentSelectionStep />);

    expect(screen.getByText(GENERIC)).toBeTruthy();
    expect(screen.queryByText(NOT_SHARED)).toBeNull();
  });

  it("keeps the generic copy for an experiment with no workbook at all", () => {
    state.flowError = new Error("Experiment exp-1 has no workbook version");

    render(<ExperimentSelectionStep />);

    expect(screen.getByText(GENERIC)).toBeTruthy();
  });

  it("says nothing while the flow loads cleanly", () => {
    render(<ExperimentSelectionStep />);

    expect(screen.queryByText(GENERIC)).toBeNull();
    expect(screen.queryByText(NOT_SHARED)).toBeNull();
  });

  it("stays quiet about a flow error while no experiment is selected", () => {
    state.selectedExperimentId = undefined;
    state.flowError = apiError(403);

    render(<ExperimentSelectionStep />);

    expect(screen.queryByText(NOT_SHARED)).toBeNull();
    expect(screen.queryByText(GENERIC)).toBeNull();
  });
});
