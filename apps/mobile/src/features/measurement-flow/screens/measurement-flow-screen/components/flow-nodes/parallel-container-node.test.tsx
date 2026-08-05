import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";
import type { FlowNode } from "~/shared/measurements/flow-node";

import { createInitialState } from "@repo/workbook";
import type { RunnerState, Track } from "@repo/workbook";

import { ParallelContainerNode } from "./parallel-container-node";

vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { attempt?: string }) => {
      const labels: Record<string, string> = {
        "measurementFlow:parallel.title": "Parallel run",
        "measurementFlow:parallel.noDevices": "No devices assigned",
        "measurementFlow:parallel.abandon": "Abandon lane",
        "measurementFlow:parallel.waiting": "Waiting",
        "measurementFlow:navigation.next": "Next",
      };
      return key === "measurementFlow:parallel.attempt"
        ? `Attempt ${values?.attempt}`
        : (labels[key] ?? key);
    },
  }),
}));

vi.mock("./instruction-node", () => ({
  InstructionNode: ({ content }: { content: { text: string } }) => content.text,
}));
vi.mock("./question-node/question-node", () => ({ QuestionNode: () => null }));
vi.mock("../flow-states/active-state", () => ({ ActiveState: () => null }));

const instructionNode = (id: string, text: string): FlowNode => ({
  id,
  name: id,
  type: "instruction",
  content: { text },
  isStart: false,
});

const containerNode: FlowNode = {
  id: "parallel-1",
  name: "Parallel",
  type: "parallel",
  isStart: true,
  content: {
    name: "parallel",
    defaultLaneId: "lane-b",
    lanes: [],
    laneNodes: {
      "lane-a": [instructionNode("instruction-a", "Prepare A")],
      "lane-b": [instructionNode("instruction-b", "Prepare B")],
    },
  },
};

function runnerState(): RunnerState {
  const state = createInitialState({ cells: [], mode: "flow" });
  const laneTrack = (id: string, laneId: string, cellId: string, deviceId: string): Track => ({
    ...state.tracks.main,
    id,
    laneId,
    deviceIds: [deviceId],
    cursor: { body: [], cellId, enteredVia: "forward", atStart: false },
    status: "awaitingHuman",
    pendingInteraction: { kind: "instruction", cellId },
  });
  const a = laneTrack("track-a", "lane-a", "instruction-a", "device-a");
  const b = laneTrack("track-b", "lane-b", "instruction-b", "device-b");
  return {
    ...state,
    devices: [
      { id: "device-a", label: "Device A", family: "multispeq" },
      { id: "device-b", label: "Device B", family: "ambit" },
    ],
    tracks: { main: state.tracks.main, [a.id]: a, [b.id]: b },
    activeContainerAttemptId: "parallel-1:1",
    parallelAttempts: {
      "parallel-1:1": {
        attemptId: "parallel-1:1",
        containerCellId: "parallel-1",
        containerName: "parallel",
        status: "running",
        lanes: {
          "lane-a": {
            laneId: "lane-a",
            label: "Lane A",
            trackId: a.id,
            deviceIds: a.deviceIds,
            status: "awaitingHuman",
            devices: [],
          },
          "lane-b": {
            laneId: "lane-b",
            label: "Lane B",
            trackId: b.id,
            deviceIds: b.deviceIds,
            status: "awaitingHuman",
            devices: [],
          },
        },
      },
    },
  };
}

describe("ParallelContainerNode", () => {
  const continueInteraction = vi.fn();
  const abandonLane = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useMeasurementFlowStore.setState({
      runnerState: runnerState(),
      continueRunnerTrackInteraction: continueInteraction,
      abandonRunnerLane: abandonLane,
    });
  });

  it("renders every lane card but presents only the first human interaction", () => {
    render(<ParallelContainerNode node={containerNode} />);

    expect(screen.getByText("Lane A")).toBeTruthy();
    expect(screen.getByText("Lane B")).toBeTruthy();
    expect(screen.getByText("Device A")).toBeTruthy();
    expect(screen.getByText("Device B")).toBeTruthy();
    expect(screen.getAllByText("Abandon lane")).toHaveLength(2);

    fireEvent.press(screen.getByText("Next"));
    expect(continueInteraction).toHaveBeenCalledWith("track-a", "instruction-a");
    fireEvent.press(screen.getAllByText("Abandon lane")[1]);
    expect(abandonLane).toHaveBeenCalledWith("track-b");
  });
});
