import AsyncStorage from "@react-native-async-storage/async-storage";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";
import { hashCells } from "@repo/workbook";

import { useFlowAnswersStore } from "./use-flow-answers-store";
import { resetWorkbookFlowForTest, useWorkbookFlowStore } from "./use-workbook-flow-store";

// Characterization of the AsyncStorage wire format of both persisted flow
// stores. A silent shape change wipes a field researcher's paused flow on
// rehydrate. Update fixtures ONLY with a deliberate change or a version bump.

const WORKBOOK_KEY = "workbook-flow-storage";
const ANSWERS_KEY = "flow-answers-storage";

const CELLS: WorkbookCell[] = [
  {
    id: "q1",
    type: "question",
    isCollapsed: false,
    name: "plant_id",
    question: { kind: "text", text: "Plant ID?", required: true },
    isAnswered: false,
  },
  {
    id: "m1",
    type: "markdown",
    isCollapsed: false,
    content: "Clip the leaf into the sensor head.",
  },
  {
    id: "p1",
    type: "protocol",
    isCollapsed: false,
    payload: { protocolId: "proto-7", version: 1, name: "SPAD" },
  },
] as WorkbookCell[];

// The runner's own v1 snapshot wire format (schemaVersion + cellsHash + pure
// JSON state), paused mid-flow on the question cell of iteration 1.
const RUNNER_SNAPSHOT = {
  schemaVersion: 1,
  savedAt: 1750000000000,
  cellsHash: hashCells(CELLS),
  state: {
    schemaVersion: 1,
    mode: "flow",
    options: {
      loop: true,
      maxBranchVisits: 100,
      allowDeviceWrites: false,
      deviceFamily: "multispeq",
    },
    cells: CELLS,
    status: "awaitingInput",
    position: { cellId: "q1", enteredVia: "forward", atStart: true },
    runAllActive: false,
    stopRequested: false,
    cycle: 1,
    answersByCycle: [{ q1: "P-001" }, { q1: "P-002" }],
    outputs: { p1: { v: { device_name: "MultispeQ v2.0", sample: [{ spad: 41.2 }] } } },
    branchVisits: {},
    returnStack: [],
    cellRuns: {},
    execCounter: 3,
    effectSeq: 2,
    inFlight: null,
    progress: null,
    fatalReason: null,
    trace: [],
  },
};

const WORKBOOK_FIXTURE = JSON.stringify({
  state: {
    experimentId: "exp-42",
    experimentLabel: "Greenhouse Trial B",
    entitySnapshots: {
      protocols: { "proto-7": { code: [{ averages: 3 }], family: "multispeq" } },
      macros: {},
    },
    snapshot: RUNNER_SNAPSHOT,
  },
  version: 1,
});

// v0 envelope after two completed answer iterations with per-question
// autoincrement/remember toggles.
const ANSWERS_FIXTURE = `{
  "state": {
    "answersHistory": [
      { "plant_id": "P-001", "leaf_count": "4" },
      { "plant_id": "P-002", "leaf_count": "6" }
    ],
    "autoincrementSettings": { "plant_id": true, "leaf_count": false },
    "rememberAnswerSettings": { "leaf_count": true, "plant_id": false }
  },
  "version": 0
}`;

const ANSWERS_STATE = (JSON.parse(ANSWERS_FIXTURE) as { state: Record<string, unknown> }).state;

async function readEnvelope(key: string): Promise<Record<string, unknown>> {
  // persist's write-back lands a microtask after setState; poll until it does.
  const raw = await vi.waitFor(async () => {
    const value = await AsyncStorage.getItem(key);
    if (value === null) throw new Error("persist write-back has not landed yet");
    return value;
  });
  return JSON.parse(raw) as Record<string, unknown>;
}

describe("workbook-flow-storage v1 wire format", () => {
  beforeAll(async () => {
    await AsyncStorage.setItem(WORKBOOK_KEY, WORKBOOK_FIXTURE);
    await useWorkbookFlowStore.persist.rehydrate();
    // Rehydration restores the runner asynchronously; wait for the mirror.
    await vi.waitFor(() => {
      if (useWorkbookFlowStore.getState().runnerState === null) {
        throw new Error("runner not restored yet");
      }
    });
  });

  afterAll(() => {
    resetWorkbookFlowForTest();
  });

  it("rehydrates the persisted identity fields", () => {
    const state = useWorkbookFlowStore.getState();
    expect(state.experimentId).toBe("exp-42");
    expect(state.experimentLabel).toBe("Greenhouse Trial B");
    expect(state.entitySnapshots?.protocols["proto-7"]?.code).toEqual([{ averages: 3 }]);
  });

  it("restores the runner exactly where the researcher paused", () => {
    const state = useWorkbookFlowStore.getState();
    expect(state.runnerState?.position.cellId).toBe("q1");
    expect(state.iterationCount).toBe(1);
    expect(state.currentNode?.id).toBe("q1");
    expect(state.flowNodes.map((n) => n.type)).toEqual(["question", "instruction", "measurement"]);
    // The paused scan output survives, keyed to the protocol cell.
    expect(state.scanResult).toEqual({ device_name: "MultispeQ v2.0", sample: [{ spad: 41.2 }] });
  });

  it("persists exactly the known field set", () => {
    const { partialize } = useWorkbookFlowStore.persist.getOptions();
    if (!partialize) throw new Error("store no longer configures partialize");
    const persisted = partialize(useWorkbookFlowStore.getState()) as Record<string, unknown>;
    // Adding a persisted field must update this list AND the fixture above.
    expect(Object.keys(persisted).sort()).toEqual([
      "entitySnapshots",
      "experimentId",
      "experimentLabel",
      "snapshot",
    ]);
  });

  it("writes a v1 envelope carrying the runner's own v1 snapshot format", async () => {
    await AsyncStorage.removeItem(WORKBOOK_KEY);
    useWorkbookFlowStore.setState({}); // identity write still runs partialize + setItem
    const envelope = await readEnvelope(WORKBOOK_KEY);
    expect(Object.keys(envelope).sort()).toEqual(["state", "version"]);
    expect(envelope.version).toBe(1);
    const state = envelope.state as Record<string, unknown>;
    expect(state.experimentId).toBe("exp-42");
    const snapshot = state.snapshot as {
      schemaVersion: number;
      cellsHash: string;
      state: Record<string, unknown>;
    };
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.cellsHash).toBe(hashCells(CELLS));
    expect((snapshot.state.position as { cellId: string }).cellId).toBe("q1");
    expect(snapshot.state.cycle).toBe(1);
    expect(snapshot.state.answersByCycle).toEqual([{ q1: "P-001" }, { q1: "P-002" }]);
  });

  it("drops an unrestorable snapshot instead of crashing", async () => {
    const broken = JSON.parse(WORKBOOK_FIXTURE) as {
      state: { snapshot: { cellsHash: string } };
    };
    broken.state.snapshot.cellsHash = "deadbeef";
    await AsyncStorage.setItem(WORKBOOK_KEY, JSON.stringify({ ...broken, version: 1 }));
    await useWorkbookFlowStore.persist.rehydrate();
    await vi.waitFor(() => {
      if (useWorkbookFlowStore.getState().experimentId !== undefined) {
        throw new Error("stale flow not dropped yet");
      }
    });
    expect(useWorkbookFlowStore.getState().runnerState).toBeNull();
  });
});

describe("flow-answers-storage v0 wire format", () => {
  beforeAll(async () => {
    await AsyncStorage.setItem(ANSWERS_KEY, ANSWERS_FIXTURE);
    await useFlowAnswersStore.persist.rehydrate();
  });

  it.each(Object.keys(ANSWERS_STATE))("rehydrates persisted field %s", (key) => {
    const state = useFlowAnswersStore.getState() as unknown as Record<string, unknown>;
    expect(state[key]).toEqual(ANSWERS_STATE[key]);
  });

  it("round-trips the envelope unchanged through partialize", async () => {
    await AsyncStorage.removeItem(ANSWERS_KEY);
    useFlowAnswersStore.setState({}); // identity write still runs partialize + setItem
    const envelope = await readEnvelope(ANSWERS_KEY);
    expect(Object.keys(envelope).sort()).toEqual(["state", "version"]);
    expect(envelope.version).toBe(0);
    expect(envelope.state).toEqual(ANSWERS_STATE);
  });

  it("persists exactly the known field set", () => {
    const { partialize } = useFlowAnswersStore.persist.getOptions();
    if (!partialize) throw new Error("store no longer configures partialize");
    const persisted = partialize(useFlowAnswersStore.getState()) as Record<string, unknown>;
    // Adding a persisted field must update this list AND the fixture above.
    expect(Object.keys(persisted).sort()).toEqual([
      "answersHistory",
      "autoincrementSettings",
      "rememberAnswerSettings",
    ]);
  });
});
