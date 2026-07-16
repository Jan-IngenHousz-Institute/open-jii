import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { useFlowAnswersStore } from "./use-flow-answers-store";
import { useMeasurementFlowStore } from "./use-measurement-flow-store";

// Characterization of the AsyncStorage wire format of both persisted flow
// stores (pinned at version 1). A silent shape change wipes a field
// researcher's paused flow on rehydrate. v1 deliberately discards pre-fix v0
// payloads; update fixtures ONLY with a deliberate change or a version bump.

const MEASUREMENT_KEY = "measurement-flow-storage";
const ANSWERS_KEY = "flow-answers-storage";

// A pre-fix v0 envelope for each store: rehydrating it must reset to defaults.
const MEASUREMENT_V0 = `{ "state": { "experimentId": "old-exp", "iterationCount": 5 }, "version": 0 }`;
const ANSWERS_V0 = `{ "state": { "answersHistory": [{ "plot": "old" }], "autoincrementSettings": { "plot": true }, "rememberAnswerSettings": {} }, "version": 0 }`;

// v0 envelope for a paused mid-flow session, parked on the measurement node.
// Every value differs from the store default so a key dropped from partialize
// fails its per-field assert instead of silently matching the default.
const MEASUREMENT_FIXTURE = `{
  "state": {
    "experimentId": "exp-42",
    "experimentLabel": "Greenhouse Trial B",
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
  "version": 1
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

// Dropped from the persisted slice (protocolId is now derived from flowNodes
// via flowProtocolId). The fixture keeps it so we prove legacy payloads
// still rehydrate; the app neither reads nor re-writes it.
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

describe("measurement-flow-storage v1 wire format", () => {
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
    expect(envelope.version).toBe(1);
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
    ]);
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

// The v0 -> v1 bump deliberately discards flows persisted by pre-fix builds
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
