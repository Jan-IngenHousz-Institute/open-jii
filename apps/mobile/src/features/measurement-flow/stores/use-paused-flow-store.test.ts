import { beforeEach, describe, expect, it } from "vitest";
import type { FlowNode } from "~/features/measurement-flow/screens/measurement-flow-screen/types";

import { usePausedFlowStore } from "./use-paused-flow-store";
import type { PausedFlowSnapshot } from "./use-paused-flow-store";

const makeQuestion = (id: string): FlowNode =>
  ({ id, type: "question", name: id, content: { kind: "text" } }) as FlowNode;

function makeSnapshot(overrides: Partial<PausedFlowSnapshot> = {}): PausedFlowSnapshot {
  return {
    experimentId: "exp-1",
    experimentLabel: "Drought stress response",
    currentFlowStep: 2,
    totalSteps: 8,
    iterationCount: 0,
    isQuestionsSubmitPending: false,
    isFromOverview: false,
    flowNodes: [makeQuestion("q1"), makeQuestion("q2")],
    answersHistory: [{ q1: "a" }],
    pausedAt: "2026-05-18T08:42:00.000Z",
    ...overrides,
  };
}

function resetStore() {
  usePausedFlowStore.setState({ snapshot: undefined });
}

describe("usePausedFlowStore", () => {
  beforeEach(resetStore);

  it("stores the snapshot on pauseFlow", () => {
    const snap = makeSnapshot();
    usePausedFlowStore.getState().pauseFlow(snap);
    expect(usePausedFlowStore.getState().snapshot).toEqual(snap);
  });

  it("overwrites a previous snapshot when paused again", () => {
    usePausedFlowStore.getState().pauseFlow(makeSnapshot({ experimentId: "exp-old" }));
    usePausedFlowStore.getState().pauseFlow(makeSnapshot({ experimentId: "exp-new" }));
    expect(usePausedFlowStore.getState().snapshot?.experimentId).toBe("exp-new");
  });

  it("discardPausedFlow clears the snapshot", () => {
    usePausedFlowStore.getState().pauseFlow(makeSnapshot());
    usePausedFlowStore.getState().discardPausedFlow();
    expect(usePausedFlowStore.getState().snapshot).toBeUndefined();
  });

  it("resumePausedFlow returns and clears atomically", () => {
    const snap = makeSnapshot();
    usePausedFlowStore.getState().pauseFlow(snap);
    const result = usePausedFlowStore.getState().resumePausedFlow();
    expect(result).toEqual(snap);
    expect(usePausedFlowStore.getState().snapshot).toBeUndefined();
  });

  it("resumePausedFlow returns undefined when no snapshot exists", () => {
    expect(usePausedFlowStore.getState().resumePausedFlow()).toBeUndefined();
  });
});
