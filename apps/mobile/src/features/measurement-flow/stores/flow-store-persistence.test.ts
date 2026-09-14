import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { hasUnresolvedSnapshotCode } from "~/features/measurement-flow/domain/flow-snapshots";
import type { FlowNode } from "~/shared/measurements/flow-node";

import { useFlowAnswersStore } from "./use-flow-answers-store";
import { useMeasurementFlowStore } from "./use-measurement-flow-store";

// Characterization of the AsyncStorage wire format of both persisted flow
// stores (measurement flow v2, answers v1). A silent shape change wipes a field
// researcher's paused flow on rehydrate. Measurement v2 deliberately discards
// older flows that cannot be correlated safely; update fixtures only deliberately.

const MEASUREMENT_KEY = "measurement-flow-storage";
const ANSWERS_KEY = "flow-answers-storage";

// A pre-fix v0 envelope for each store: rehydrating it must reset to defaults.
const MEASUREMENT_V0 = `{ "state": { "experimentId": "old-exp", "iterationCount": 5 }, "version": 0 }`;
const ANSWERS_V0 = `{ "state": { "answersHistory": [{ "plot": "old" }], "autoincrementSettings": { "plot": true }, "rememberAnswerSettings": {} }, "version": 0 }`;

// Current v2 envelope for a paused mid-flow session, parked on the measurement node.
// Every value differs from the store default so a key dropped from partialize
// fails its per-field assert instead of silently matching the default.
const MEASUREMENT_FIXTURE = `{
  "state": {
    "experimentId": "exp-42",
    "experimentLabel": "Greenhouse Trial B",
    "workbookVersionId": "version-17",
    "workbookId": "workbook-17",
    "workbookRunId": "run-17",
    "protocolId": "proto-7",
    "currentStep": 1,
    "flowNodes": [
      {
        "id": "node-q1",
        "name": "plant_id",
        "type": "question",
        "content": { "kind": "text", "text": "Plant ID?", "required": true, "placeholder": "P-000" },
        "isStart": true,
        "position": { "x": 0, "y": 0 }
      },
      {
        "id": "node-i1",
        "name": "clip_leaf",
        "type": "instruction",
        "content": { "text": "Clip the leaf into the sensor head." },
        "isStart": false,
        "position": { "x": 0, "y": 120 }
      },
      {
        "id": "node-m1",
        "name": "spad_reading",
        "type": "measurement",
        "content": { "params": { "averages": 3 }, "protocolId": "proto-7" },
        "isStart": false,
        "position": { "x": 0, "y": 240 }
      },
      {
        "id": "node-a1",
        "name": "spad_macro",
        "type": "analysis",
        "content": { "params": { "threshold": 40 }, "macroId": "macro-9" },
        "isStart": false,
        "position": { "x": 0, "y": 360 }
      }
    ],
    "currentFlowStep": 2,
    "iterationCount": 3,
    "isFlowFinished": true,
    "isQuestionsSubmitPending": true,
    "scanResult": { "device_name": "MultispeQ v2.0", "spad": [41.2, 39.8] },
    "scanResults": [
      {
        "device": { "id": "1002", "name": "MultispeQ #1002" },
        "result": { "device_name": "MultispeQ v2.0", "spad": [41.2, 39.8] }
      }
    ],
    "producerCellId": "node-m1",
    "cellOutputs": { "node-a1": { "spad_avg": 40.5 } },
    "isFromOverview": true,
    "cells": [{ "id": "cell-b1", "type": "branch", "name": "N branch" }],
    "edges": [{ "id": "edge-1", "source": "node-q1", "target": "node-m1" }],
    "lastMatchedPath": { "label": "High N", "color": "#22c55e" },
    "branchVisitCounts": { "node-b1": 2 },
    "branchReturnStack": [{ "landing": 3, "step": 1 }]
  },
  "version": 2
}`;

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
  "version": 1
}`;

const MEASUREMENT_STATE = (JSON.parse(MEASUREMENT_FIXTURE) as { state: Record<string, unknown> })
  .state;
const MEASUREMENT_V1_WITHOUT_RUN = `{ "state": { "experimentId": "exp-v1", "currentFlowStep": 3, "scanResult": { "sample": [{ "phi2": 0.8 }] } }, "version": 1 }`;

// Dropped from the persisted slice (uploads now resolve it from the exact
// producer measurement node). The fixture keeps it so we prove legacy
// payloads still rehydrate; the app neither reads nor re-writes it.
const LEGACY_ONLY_KEYS = ["protocolId"];
const EXPECTED_WRITTEN_STATE = Object.fromEntries(
  Object.entries(MEASUREMENT_STATE).filter(([key]) => !LEGACY_ONLY_KEYS.includes(key)),
);
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

describe("measurement-flow-storage v2 wire format", () => {
  beforeAll(async () => {
    await AsyncStorage.setItem(MEASUREMENT_KEY, MEASUREMENT_FIXTURE);
    await useMeasurementFlowStore.persist.rehydrate();
  });

  it.each(Object.keys(EXPECTED_WRITTEN_STATE))("rehydrates persisted field %s", (key) => {
    const state = useMeasurementFlowStore.getState() as unknown as Record<string, unknown>;
    expect(state[key]).toEqual(MEASUREMENT_STATE[key]);
  });

  it("tolerates legacy payloads carrying the removed protocolId key", () => {
    // Rehydration of the fixture above (which includes protocolId) must not
    // throw or disturb the managed fields; the key is simply ignored.
    const state = useMeasurementFlowStore.getState() as unknown as Record<string, unknown>;
    expect(state.experimentId).toBe("exp-42");
  });

  it("round-trips the envelope unchanged through partialize", async () => {
    await AsyncStorage.removeItem(MEASUREMENT_KEY);
    useMeasurementFlowStore.setState({}); // identity write still runs partialize + setItem
    const envelope = await readEnvelope(MEASUREMENT_KEY);
    expect(Object.keys(envelope).sort()).toEqual(["state", "version"]);
    expect(envelope.version).toBe(2);
    expect(envelope.state).toEqual(EXPECTED_WRITTEN_STATE);
  });

  it("persists exactly the known field set", () => {
    const { partialize } = useMeasurementFlowStore.persist.getOptions();
    if (!partialize) throw new Error("store no longer configures partialize");
    const persisted = partialize(useMeasurementFlowStore.getState()) as Record<string, unknown>;
    // Adding a persisted field must update this list AND the fixture above.
    expect(Object.keys(persisted).sort()).toEqual([
      "branchReturnStack",
      "branchVisitCounts",
      "cellOutputs",
      "cells",
      "currentFlowStep",
      "currentStep",
      "edges",
      "experimentId",
      "experimentLabel",
      "flowNodes",
      "isFlowFinished",
      "isFromOverview",
      "isQuestionsSubmitPending",
      "iterationCount",
      "lastMatchedPath",
      "producerCellId",
      "scanResult",
      "scanResults",
      "workbookId",
      "workbookRunId",
      "workbookVersionId",
    ]);
  });
});

// Only the nested content of flowNodes changes, so the wire version stays at 2.
describe("measurement-flow-storage strips snapshot code from flowNodes", () => {
  const HYDRATED_NODES = [
    {
      id: "node-m1",
      name: "spad_reading",
      type: "measurement",
      content: {
        params: { averages: 3 },
        protocolId: "proto-7",
        protocol: { code: [{ pulses: [1, 2] }], name: "SPAD", family: "multispeq" },
      },
      isStart: false,
    },
    {
      id: "node-a1",
      name: "spad_macro",
      type: "analysis",
      content: {
        params: { threshold: 40 },
        macroId: "macro-9",
        macro: {
          id: "macro-9",
          name: "SPAD macro",
          filename: "macro-9.py",
          language: "python",
          code: "print(1)",
        },
      },
      isStart: false,
    },
  ] as unknown as FlowNode[];

  async function persistedFlowNodes(): Promise<Record<string, any>[]> {
    await AsyncStorage.removeItem(MEASUREMENT_KEY);
    useMeasurementFlowStore.setState({}); // identity write still runs partialize + setItem
    const envelope = await readEnvelope(MEASUREMENT_KEY);
    return (envelope.state as { flowNodes: Record<string, any>[] }).flowNodes;
  }

  it("writes protocol/macro without a code key", async () => {
    useMeasurementFlowStore.setState({ flowNodes: HYDRATED_NODES });

    const [measurement, analysis] = await persistedFlowNodes();

    expect(measurement.content.protocol).toStrictEqual({ name: "SPAD", family: "multispeq" });
    expect(analysis.content.macro).toStrictEqual({
      id: "macro-9",
      name: "SPAD macro",
      filename: "macro-9.py",
      language: "python",
    });
    // Absent, not null: null would round-trip as "resolved, empty".
    expect("code" in measurement.content.protocol).toBe(false);
    expect("code" in analysis.content.macro).toBe(false);
    expect(measurement.content).toMatchObject({
      params: { averages: 3 },
      protocolId: "proto-7",
    });
    expect(analysis.content).toMatchObject({ params: { threshold: 40 }, macroId: "macro-9" });
  });

  it("keeps the code in memory after setFlowGraph; only the storage copy is stripped", async () => {
    useMeasurementFlowStore
      .getState()
      .setFlowGraph(HYDRATED_NODES, [], [], "version-17", "workbook-17");

    const inMemory = useMeasurementFlowStore.getState().flowNodes;
    expect(inMemory[0].content.protocol.code).toEqual([{ pulses: [1, 2] }]);
    expect(inMemory[1].content.macro.code).toBe("print(1)");

    const [measurement] = await persistedFlowNodes();
    expect(measurement.content.protocol.code).toBeUndefined();
  });

  it("rehydrates a legacy v2 payload that still carries code, with nothing to resolve", async () => {
    const legacy = JSON.stringify({
      state: { ...MEASUREMENT_STATE, flowNodes: HYDRATED_NODES },
      version: 2,
    });
    await AsyncStorage.setItem(MEASUREMENT_KEY, legacy);
    await useMeasurementFlowStore.persist.rehydrate();

    const { flowNodes } = useMeasurementFlowStore.getState();
    expect(flowNodes[0].content.protocol.code).toEqual([{ pulses: [1, 2] }]);
    expect(flowNodes[1].content.macro.code).toBe("print(1)");
    expect(hasUnresolvedSnapshotCode(flowNodes)).toBe(false);
  });
});

describe("measurement-flow-storage v1 to v2 migration", () => {
  it("drops an active v1 flow and returns to experiment selection", async () => {
    await AsyncStorage.setItem(MEASUREMENT_KEY, MEASUREMENT_V1_WITHOUT_RUN);
    await useMeasurementFlowStore.persist.rehydrate();

    const state = useMeasurementFlowStore.getState();
    expect(state.experimentId).toBeUndefined();
    expect(state.workbookRunId).toBeUndefined();
    expect(state.scanResult).toBeUndefined();
    expect(state.currentFlowStep).toBe(0);
    expect(state.flowNodes).toEqual([]);

    const envelope = await readEnvelope(MEASUREMENT_KEY);
    expect(envelope.version).toBe(2);
    expect(envelope.state).toMatchObject({
      currentFlowStep: 0,
      flowNodes: [],
      iterationCount: 0,
    });
  });
});

describe("flow-answers-storage v1 wire format", () => {
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
    expect(envelope.version).toBe(1);
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

// Version upgrades deliberately discard flows persisted by pre-fix builds
// (they can hold a mis-seeded plot or a stale "Experiment" name). These run
// last: rehydrating a v0 payload resets the singleton stores to defaults.
describe("flow stores discard pre-fix v0 payloads on upgrade", () => {
  it("resets the measurement flow store to initial state", async () => {
    await AsyncStorage.setItem(MEASUREMENT_KEY, MEASUREMENT_V0);
    await useMeasurementFlowStore.persist.rehydrate();
    const state = useMeasurementFlowStore.getState();
    expect(state.experimentId).toBeUndefined();
    expect(state.iterationCount).toBe(0);
    expect(state.flowNodes).toEqual([]);
  });

  it("clears the answer history", async () => {
    await AsyncStorage.setItem(ANSWERS_KEY, ANSWERS_V0);
    await useFlowAnswersStore.persist.rehydrate();
    const state = useFlowAnswersStore.getState();
    expect(state.answersHistory).toEqual([]);
    expect(state.autoincrementSettings).toEqual({});
    expect(state.rememberAnswerSettings).toEqual({});
  });
});
