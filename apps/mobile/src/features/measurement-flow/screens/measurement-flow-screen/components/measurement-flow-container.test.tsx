import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import {
  flushRunnerMeasurementFlowSnapshot,
  resetRunnerMeasurementFlowForTest,
  useMeasurementFlowStore,
} from "~/features/measurement-flow/stores/use-measurement-flow-store";
import { hydrateFlowNodes } from "~/features/measurement-flow/utils/hydrate-flow-nodes";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import { cellsToFlowGraph } from "@repo/api/transforms/cells-to-flow";

import { MeasurementFlowContainer } from "./measurement-flow-container";
import { NavigationButtons } from "./navigation-buttons";

const scanner = vi.hoisted(() => {
  const state = {
    executors: new Map<string, unknown>(),
  };
  const hook = Object.assign(
    vi.fn((selector: (value: typeof state) => unknown) => selector(state)),
    {
      getState: () => state,
      subscribe: vi.fn(() => () => undefined),
    },
  );
  return { state, hook };
});

const host = vi.hoisted(() => ({
  useExperiments: vi.fn(),
  useSession: vi.fn(),
  useQuestionsUpload: vi.fn(),
  finishAndExit: vi.fn(),
}));

vi.mock("~/features/connection/stores/use-scanner-command-executor-store", () => ({
  useScannerCommandExecutorStore: scanner.hook,
}));
vi.mock("~/features/experiments/hooks/use-experiments", () => ({
  useExperiments: () => host.useExperiments(),
}));
vi.mock("~/features/auth/hooks/use-session", () => ({
  useSession: () => host.useSession(),
}));
vi.mock("~/features/recent-measurements/hooks/use-questions-upload", () => ({
  useQuestionsUpload: () => host.useQuestionsUpload(),
}));
vi.mock("~/features/measurement-flow/hooks/use-finish-flow", () => ({
  useFinishFlow: () => host.finishAndExit,
}));
vi.mock("./experiment-selection-step", () => ({ ExperimentSelectionStep: () => null }));
vi.mock("./flow-nodes/analysis-node/analysis-node", () => ({ AnalysisNode: () => null }));
vi.mock("./flow-nodes/command-node/command-node", () => ({ CommandNode: () => null }));
vi.mock("./flow-nodes/instruction-node", () => ({ InstructionNode: () => null }));
vi.mock("./flow-nodes/measurement-node/measurement-node", () => ({
  MeasurementNode: () => null,
}));
vi.mock("./flow-nodes/parallel-container-node", () => ({ ParallelContainerNode: () => null }));
vi.mock("./flow-nodes/qr-scanner-modal", () => ({ QRScannerModal: () => null }));
vi.mock("~/shared/time/time-sync", () => ({
  getSyncedUtcISO: () => "2026-08-07T08:00:00.000Z",
  getSyncedLocalISO: () => "2026-08-07T10:00:00.000+02:00",
  getTimeSyncState: () => ({ timezone: "Europe/Amsterdam" }),
}));
vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        "measurementFlow:measurementNode.readyState.overviewHeading": "Overview of your answers",
        "measurementFlow:measurementNode.readyState.notSet": "Not set",
        "measurementFlow:questionsSubmit.finish": "Finish",
        "measurementFlow:questionsSubmit.submitContinue": "Submit & Continue",
        "measurementFlow:navigation.backToOverview": "Back to overview",
        "measurementFlow:questionNode.rememberAnswer": "Remember answer",
        "measurementFlow:questionTypes.openEnded.placeholder": "Enter a lane note",
      };
      return labels[key] ?? key;
    },
  }),
}));

const nestedQuestion: Extract<WorkbookCell, { type: "question" }> = {
  id: "lane-question",
  type: "question",
  isCollapsed: false,
  name: "Lane note",
  question: {
    kind: "open_ended",
    text: "Nested lane question",
    required: false,
  },
  isAnswered: false,
};

const questionsOnlyParallel: Extract<WorkbookCell, { type: "parallel" }> = {
  id: "parallel-questions",
  type: "parallel",
  isCollapsed: false,
  name: "question_lanes",
  defaultLaneId: "lane-a",
  lanes: [
    {
      id: "lane-a",
      label: "Lane A",
      color: "#0a0",
      conditions: [],
      body: [nestedQuestion],
    },
  ],
};

async function completeQuestionsOnlyParallelFlow(): Promise<void> {
  const cells: WorkbookCell[] = [questionsOnlyParallel];
  const graph = cellsToFlowGraph(cells);
  const nodes = hydrateFlowNodes(graph.nodes, cells, { protocols: {}, macros: {} });
  act(() => {
    useMeasurementFlowStore.getState().setFlowGraph(nodes, graph.edges, cells, "version-1");
    useMeasurementFlowStore.getState().setExperimentId("experiment-1", "Experiment");
  });

  const trackId = await waitFor(() => {
    const attempt =
      useMeasurementFlowStore.getState().runnerState?.parallelAttempts["parallel-questions:1"];
    const laneTrackId = attempt?.lanes["lane-a"]?.trackId;
    expect(laneTrackId).toBeTruthy();
    if (!laneTrackId) throw new Error("expected the parallel question lane to own a track");
    expect(useMeasurementFlowStore.getState().runnerState?.tracks[laneTrackId]).toMatchObject({
      pendingInteraction: { kind: "question", cellId: "lane-question" },
    });
    return laneTrackId;
  });

  act(() => {
    useFlowAnswersStore.getState().setAnswer(0, "lane-question", "Original note");
    useMeasurementFlowStore
      .getState()
      .continueRunnerTrackInteraction(trackId, "lane-question", "Original note");
  });
  await waitFor(() => {
    expect(useMeasurementFlowStore.getState()).toMatchObject({
      isQuestionsSubmitPending: true,
      overviewNodeId: null,
    });
    expect(useMeasurementFlowStore.getState().runnerState?.status).toBe("done");
  });
  act(() => flushRunnerMeasurementFlowSnapshot());
}

beforeEach(() => {
  resetRunnerMeasurementFlowForTest();
  scanner.state.executors = new Map([
    [
      "device-a",
      {
        device: { id: "device-a", name: "Device A", type: "usb" },
        identity: {
          family: "multispeq",
          name: "MultispeQ",
          deviceId: "firmware-a",
          raw: {},
        },
      },
    ],
  ]);
  useFlowAnswersStore.getState().clearHistory();
  host.useExperiments.mockReturnValue({ experiments: [] });
  host.useSession.mockReturnValue({ session: { data: { user: { id: "user-1" } } } });
  host.useQuestionsUpload.mockReturnValue({ isUploading: false, uploadQuestions: vi.fn() });
});

afterEach(() => {
  act(() => resetRunnerMeasurementFlowForTest());
});

describe("MeasurementFlowContainer questions-only overview editing", () => {
  it("opens a nested lane question from terminal review and returns to review", async () => {
    await completeQuestionsOnlyParallelFlow();
    render(
      <>
        <MeasurementFlowContainer />
        <NavigationButtons />
      </>,
    );

    expect(screen.getByText("Overview of your answers")).toBeTruthy();
    expect(screen.getByText("Original note")).toBeTruthy();
    act(() => fireEvent.press(screen.getByText("Nested lane question")));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter a lane note")).toBeTruthy();
      expect(screen.getByText("Back to overview")).toBeTruthy();
      expect(useMeasurementFlowStore.getState()).toMatchObject({
        overviewNodeId: "lane-question",
        isFromOverview: true,
        isQuestionsSubmitPending: false,
      });
    });
    act(() =>
      fireEvent.changeText(screen.getByPlaceholderText("Enter a lane note"), "Edited note"),
    );
    await act(async () => {
      fireEvent.press(screen.getByText("Back to overview"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText("Overview of your answers")).toBeTruthy();
      expect(screen.getByText("Edited note")).toBeTruthy();
      expect(screen.queryByPlaceholderText("Enter a lane note")).toBeNull();
      expect(useMeasurementFlowStore.getState()).toMatchObject({
        overviewNodeId: null,
        isFromOverview: false,
        isQuestionsSubmitPending: true,
      });
    });
  });
});
