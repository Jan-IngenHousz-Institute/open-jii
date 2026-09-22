import { render, screen } from "@testing-library/react-native";
import React from "react";
import { View } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ExperimentSelectionStep } from "./experiment-selection-step";

interface PickerState {
  selectedExperimentId: string | undefined;
  flowError: unknown;
}

const state = vi.hoisted<PickerState>(() => ({
  selectedExperimentId: "exp-1",
  flowError: undefined,
}));

vi.mock("~/features/connection/hooks/use-device-connection", () => ({
  useConnectedDevice: () => ({ data: undefined }),
}));
vi.mock("~/features/connection/stores/use-device-sheet-store", () => ({
  useDeviceSheetStore: { getState: () => ({ open: vi.fn() }) },
}));
vi.mock("~/features/experiments/hooks/use-experiments", () => ({
  useExperiments: () => ({
    experiments: [{ value: "exp-1", label: "Canopy Phi2 Sweep" }],
    isLoading: false,
    error: undefined,
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
      })[key] ?? key,
  }),
}));

function apiError(status: number) {
  return Object.assign(new Error(`status ${status}`), { status });
}

const NOT_SHARED =
  "This experiment's workbook isn't shared with you. Ask the organizer to make it public.";
const GENERIC = "Failed to load experiment. Please try again.";

beforeEach(() => {
  state.selectedExperimentId = "exp-1";
  state.flowError = undefined;
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
