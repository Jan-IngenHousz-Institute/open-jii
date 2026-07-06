import AsyncStorage from "@react-native-async-storage/async-storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";
import type { EntitySnapshots } from "@repo/api/schemas/workbook-version.schema";

import { useFlowAnswersStore } from "./use-flow-answers-store";
import {
  flushWorkbookSnapshot,
  resetWorkbookFlowForTest,
  useWorkbookFlowStore,
} from "./use-workbook-flow-store";

// Device + macro boundaries are mocked; the WorkbookRunner itself runs real.
const { executeCommand, cancelCommand, applyMacro } = vi.hoisted(() => ({
  executeCommand: vi.fn(),
  cancelCommand: vi.fn(),
  applyMacro: vi.fn(),
}));

vi.mock("~/features/connection/stores/use-scanner-command-executor-store", () => ({
  useScannerCommandExecutorStore: {
    getState: () => ({ executeCommand, cancelCommand }),
  },
}));

vi.mock("~/features/measurement-flow/utils/process-scan/process-scan", () => ({
  applyMacro: (...args: unknown[]) => applyMacro(...args) as Promise<unknown>,
}));

vi.mock("~/features/measurement-flow/utils/play-sound", () => ({
  playSound: () => Promise.resolve(),
}));

const PROTO_CODE = [{ averages: 3 }];
const SCAN = { device_name: "MultispeQ v2.0", device_battery: 88, sample: [{ spad: 41.2 }] };

const CELLS: WorkbookCell[] = [
  {
    id: "q1",
    type: "question",
    isCollapsed: false,
    name: "plant_id",
    question: { kind: "text", text: "Plant ID?", required: true },
    isAnswered: false,
  },
  { id: "i1", type: "markdown", isCollapsed: false, content: "Clip the leaf." },
  {
    id: "p1",
    type: "protocol",
    isCollapsed: false,
    payload: { protocolId: "proto-7", version: 1, name: "SPAD" },
  },
  {
    id: "m1",
    type: "macro",
    isCollapsed: false,
    payload: { macroId: "macro-9", language: "javascript", name: "SPAD macro" },
  },
] as unknown as WorkbookCell[];

const SNAPSHOTS: EntitySnapshots = {
  protocols: { "proto-7": { code: PROTO_CODE, family: "multispeq" } },
  macros: { "macro-9": { code: "Y29kZQ==" } },
} as EntitySnapshots;

const QUESTIONS_ONLY_CELLS: WorkbookCell[] = [
  {
    id: "q1",
    type: "question",
    isCollapsed: false,
    name: "plant_id",
    question: { kind: "text", text: "Plant ID?", required: false },
    isAnswered: false,
  },
] as unknown as WorkbookCell[];

function startMeasurementFlow(cells: WorkbookCell[] = CELLS) {
  const store = useWorkbookFlowStore.getState();
  store.prepareFlow(cells, SNAPSHOTS);
  useWorkbookFlowStore.getState().startFlow("exp-1", "Trial B");
}

function currentQuestionNode() {
  const node = useWorkbookFlowStore.getState().currentNode;
  if (!node) throw new Error("no current node");
  return node;
}

async function answerThroughToGate() {
  const store = useWorkbookFlowStore.getState();
  useFlowAnswersStore.getState().setAnswer(0, "q1", "P-001");
  store.commitAnswer(currentQuestionNode(), "P-001");
  // Parks on the instruction in iteration 0.
  expect(useWorkbookFlowStore.getState().currentNode?.type).toBe("instruction");
  useWorkbookFlowStore.getState().next();
  await vi.waitFor(() => {
    if (!useWorkbookFlowStore.getState().awaitingScanStart) throw new Error("gate not armed");
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  await AsyncStorage.clear();
  resetWorkbookFlowForTest();
  useFlowAnswersStore.getState().clearHistory();
  applyMacro.mockResolvedValue([{ spad_mean: 40 }]);
  executeCommand.mockResolvedValue(SCAN);
  cancelCommand.mockResolvedValue(undefined);
});

afterEach(() => {
  resetWorkbookFlowForTest();
});

describe("tap-to-scan mapping", () => {
  it("parks the producer behind the gate instead of auto-sending the command", async () => {
    startMeasurementFlow();
    expect(useWorkbookFlowStore.getState().currentNode?.id).toBe("q1");

    await answerThroughToGate();

    const state = useWorkbookFlowStore.getState();
    expect(state.currentNode?.id).toBe("p1");
    expect(state.runnerState?.status).toBe("running");
    expect(state.awaitingScanStart).toBe(true);
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it("runs the device command on Start, records the output, and parks on analysis", async () => {
    startMeasurementFlow();
    await answerThroughToGate();

    useWorkbookFlowStore.getState().startScan("p1");
    await vi.waitFor(() => {
      if (useWorkbookFlowStore.getState().currentNode?.id !== "m1") {
        throw new Error("not parked on the macro cell yet");
      }
    });

    expect(executeCommand).toHaveBeenCalledWith(PROTO_CODE);
    const state = useWorkbookFlowStore.getState();
    expect(state.scanResult).toEqual(SCAN);
    // Analysis parks behind its own gate until upload/continue.
    expect(state.runnerState?.status).toBe("running");
  });

  it("cancel re-arms the producer; the next tap re-runs it", async () => {
    startMeasurementFlow();
    await answerThroughToGate();

    useWorkbookFlowStore.getState().cancelScan();
    await vi.waitFor(() => {
      if (useWorkbookFlowStore.getState().runnerState?.status !== "awaitingInput") {
        throw new Error("cancel not settled");
      }
    });
    expect(useWorkbookFlowStore.getState().runnerState?.cellRuns.p1?.status).toBe("cancelled");
    expect(executeCommand).not.toHaveBeenCalled();

    useWorkbookFlowStore.getState().startScan("p1");
    await vi.waitFor(() => {
      if (!executeCommand.mock.calls.length) throw new Error("re-run not started");
    });
  });

  it("surfaces a device failure as pausedError with the raw error retained", async () => {
    executeCommand.mockRejectedValue(new Error("Failed to write to device"));
    startMeasurementFlow();
    await answerThroughToGate();

    useWorkbookFlowStore.getState().startScan("p1");
    await vi.waitFor(() => {
      if (useWorkbookFlowStore.getState().runnerState?.status !== "pausedError") {
        throw new Error("failure not recorded");
      }
    });
    const state = useWorkbookFlowStore.getState();
    expect(state.currentNode?.id).toBe("p1");
    expect((state.scanError as Error).message).toBe("Failed to write to device");
  });
});

describe("iteration wrap and carry-forward", () => {
  it("wraps into a new cycle on continue, carrying remembered answers into the runner", async () => {
    startMeasurementFlow();
    useFlowAnswersStore.getState().setRememberAnswer("q1", true);
    await answerThroughToGate();
    useWorkbookFlowStore.getState().startScan("p1");
    await vi.waitFor(() => {
      if (useWorkbookFlowStore.getState().currentNode?.id !== "m1") {
        throw new Error("not on analysis yet");
      }
    });

    useWorkbookFlowStore.getState().continueFromAnalysis("m1");
    // Wrap: remembered q1 auto-commits, instruction skips (cycle > 0), and the
    // flow parks on the measurement gate of the next iteration.
    await vi.waitFor(() => {
      if (useWorkbookFlowStore.getState().iterationCount !== 1) throw new Error("no wrap yet");
      if (!useWorkbookFlowStore.getState().awaitingScanStart) throw new Error("gate not armed");
    });

    const state = useWorkbookFlowStore.getState();
    expect(state.currentNode?.id).toBe("p1");
    expect(state.runnerState?.answersByCycle[1]?.q1).toBe("P-001");
    expect(useFlowAnswersStore.getState().getAnswer(1, "q1")).toBe("P-001");
    expect(state.iterationAnchor).toEqual({ iteration: 1, nodeId: undefined });
    // The previous scan survives the wrap (mobile parity).
    expect(state.scanResult).toEqual(SCAN);
  });

  it("parks on a manual question after the wrap when nothing carries", async () => {
    startMeasurementFlow();
    await answerThroughToGate();
    useWorkbookFlowStore.getState().startScan("p1");
    await vi.waitFor(() => {
      if (useWorkbookFlowStore.getState().currentNode?.id !== "m1") {
        throw new Error("not on analysis yet");
      }
    });

    useWorkbookFlowStore.getState().continueFromAnalysis("m1");
    await vi.waitFor(() => {
      if (useWorkbookFlowStore.getState().iterationCount !== 1) throw new Error("no wrap yet");
    });
    expect(useWorkbookFlowStore.getState().currentNode?.id).toBe("q1");
    expect(useWorkbookFlowStore.getState().runnerState?.status).toBe("awaitingInput");
  });
});

describe("questions-only review mapping", () => {
  it("maps runner done to the submit/review screen and START_CYCLE to continue", () => {
    startMeasurementFlow(QUESTIONS_ONLY_CELLS);
    useFlowAnswersStore.getState().setAnswer(0, "q1", "Alice");
    useWorkbookFlowStore.getState().commitAnswer(currentQuestionNode(), "Alice");

    expect(useWorkbookFlowStore.getState().isQuestionsSubmitPending).toBe(true);
    expect(useWorkbookFlowStore.getState().runnerState?.status).toBe("done");

    useWorkbookFlowStore.getState().dismissQuestionsSubmit();
    const state = useWorkbookFlowStore.getState();
    expect(state.isQuestionsSubmitPending).toBe(false);
    expect(state.iterationCount).toBe(1);
    expect(state.currentNode?.id).toBe("q1");
  });
});

describe("overview detour", () => {
  it("renders the detour question and syncs an edited answer back into the runner", async () => {
    startMeasurementFlow();
    await answerThroughToGate();

    useWorkbookFlowStore.getState().openQuestionFromOverview(0);
    expect(useWorkbookFlowStore.getState().currentNode?.id).toBe("q1");
    expect(useWorkbookFlowStore.getState().overviewNodeId).toBe("q1");

    useFlowAnswersStore.getState().setAnswer(0, "q1", "P-EDITED");
    useWorkbookFlowStore.getState().returnToOverview();

    await vi.waitFor(() => {
      if (useWorkbookFlowStore.getState().overviewNodeId !== null) {
        throw new Error("detour not closed");
      }
    });
    const state = useWorkbookFlowStore.getState();
    expect(state.currentNode?.id).toBe("p1");
    expect(state.runnerState?.answersByCycle[0]?.q1).toBe("P-EDITED");
    // The rebuilt runner re-arms the scan as interrupted; the tap re-runs it.
    expect(state.runnerState?.cellRuns.p1?.status).toBe("interrupted");
    useWorkbookFlowStore.getState().startScan("p1");
    await vi.waitFor(() => {
      if (!executeCommand.mock.calls.length) throw new Error("re-run not started");
    });
  });
});

const BRANCH_CELLS: WorkbookCell[] = [
  {
    id: "q1",
    type: "question",
    isCollapsed: false,
    name: "route",
    question: { kind: "text", text: "Route?", required: false },
    isAnswered: false,
  },
  {
    id: "b1",
    type: "branch",
    isCollapsed: false,
    paths: [
      {
        id: "path-skip",
        label: "Skip ahead",
        color: "#22c55e",
        conditions: [
          { id: "c1", sourceCellId: "q1", field: "answer", operator: "eq", value: "skip" },
        ],
        gotoCellId: "q3",
      },
    ],
  },
  {
    id: "q2",
    type: "question",
    isCollapsed: false,
    name: "middle",
    question: { kind: "text", text: "Middle?", required: false },
    isAnswered: false,
  },
  {
    id: "q3",
    type: "question",
    isCollapsed: false,
    name: "last",
    question: { kind: "text", text: "Last?", required: false },
    isAnswered: false,
  },
] as unknown as WorkbookCell[];

describe("branch routing through the runner", () => {
  it("routes a matched path, surfaces the chip, and Back unwinds past the branch", () => {
    startMeasurementFlow(BRANCH_CELLS);

    useFlowAnswersStore.getState().setAnswer(0, "q1", "skip");
    useWorkbookFlowStore.getState().commitAnswer(currentQuestionNode(), "skip");

    const routed = useWorkbookFlowStore.getState();
    expect(routed.currentNode?.id).toBe("q3");
    expect(routed.lastMatchedPath).toEqual({ label: "Skip ahead", color: "#22c55e" });

    // Back never lands on the branch: it unwinds the jump to the step before it.
    useWorkbookFlowStore.getState().back();
    expect(useWorkbookFlowStore.getState().currentNode?.id).toBe("q1");
  });

  it("falls through sequentially and clears the chip when nothing matches", () => {
    startMeasurementFlow(BRANCH_CELLS);

    useFlowAnswersStore.getState().setAnswer(0, "q1", "other");
    useWorkbookFlowStore.getState().commitAnswer(currentQuestionNode(), "other");

    const state = useWorkbookFlowStore.getState();
    expect(state.currentNode?.id).toBe("q2");
    expect(state.lastMatchedPath).toBeUndefined();
  });
});

describe("persistence round-trip", () => {
  it("restores a paused flow where it left off and never auto-resends the command", async () => {
    startMeasurementFlow();
    await answerThroughToGate();
    flushWorkbookSnapshot();
    const persisted = await vi.waitFor(async () => {
      const raw = await AsyncStorage.getItem("workbook-flow-storage");
      if (raw === null) throw new Error("persist write-back has not landed yet");
      return raw;
    });

    // Reset clears storage through the persist middleware; simulate a fresh
    // launch by putting the captured envelope back before rehydrating.
    resetWorkbookFlowForTest();
    await AsyncStorage.setItem("workbook-flow-storage", persisted);
    await useWorkbookFlowStore.persist.rehydrate();
    await vi.waitFor(() => {
      if (useWorkbookFlowStore.getState().runnerState === null) {
        throw new Error("runner not restored yet");
      }
    });

    const state = useWorkbookFlowStore.getState();
    expect(state.experimentId).toBe("exp-1");
    expect(state.currentNode?.id).toBe("p1");
    expect(state.runnerState?.status).toBe("awaitingInput");
    expect(state.runnerState?.cellRuns.p1?.status).toBe("interrupted");
    expect(state.runnerState?.answersByCycle[0]?.q1).toBe("P-001");
    expect(executeCommand).not.toHaveBeenCalled();

    useWorkbookFlowStore.getState().startScan("p1");
    await vi.waitFor(() => {
      if (!executeCommand.mock.calls.length) throw new Error("re-run not started");
    });
  });
});

describe("back and abandon", () => {
  it("Back on the first step abandons the flow (clears the persisted slice)", () => {
    startMeasurementFlow();
    expect(useWorkbookFlowStore.getState().runnerState?.position.atStart).toBe(true);

    useWorkbookFlowStore.getState().back();

    const state = useWorkbookFlowStore.getState();
    expect(state.experimentId).toBeUndefined();
    expect(state.runnerState).toBeNull();
    expect(state.flowNodes).toEqual([]);
  });

  it("Back from the gated producer cancels the gate and lands on the instruction", async () => {
    startMeasurementFlow();
    await answerThroughToGate();

    useWorkbookFlowStore.getState().back();
    await vi.waitFor(() => {
      if (useWorkbookFlowStore.getState().currentNode?.id !== "i1") {
        throw new Error("back not settled");
      }
    });
    expect(useWorkbookFlowStore.getState().runnerState?.status).toBe("awaitingInput");
    expect(executeCommand).not.toHaveBeenCalled();
  });
});
