import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { useFlowAnswersStore } from "./use-flow-answers-store";
import { useMeasurementFlowStore } from "./use-measurement-flow-store";

// Characterization of the AsyncStorage wire format of both persisted flow
// stores (measurement store pinned at v2, answers store at v1). A silent shape
// change wipes a field researcher's paused flow on rehydrate. Older versions
// are deliberately discarded; update fixtures ONLY with a version bump.

const MEASUREMENT_KEY = "measurement-flow-storage";
const ANSWERS_KEY = "flow-answers-storage";

// Stale envelopes: rehydrating any of them must reset to defaults.
const MEASUREMENT_V0 = `{ "state": { "experimentId": "old-exp", "iterationCount": 5 }, "version": 0 }`;
// v1 flowNodes carry pre-rename protocolId content the app no longer reads.
const MEASUREMENT_V1 = `{ "state": { "experimentId": "old-exp", "flowNodes": [{ "id": "node-m1", "name": "spad", "type": "measurement", "content": { "protocolId": "proto-7" }, "isStart": true }] }, "version": 1 }`;
const ANSWERS_V0 = `{ "state": { "answersHistory": [{ "plot": "old" }], "autoincrementSettings": { "plot": true }, "rememberAnswerSettings": {} }, "version": 0 }`;

// v2 envelope for a paused mid-flow session, parked on the measurement node.
// Every value differs from the store default so a key dropped from partialize
// fails its per-field assert instead of silently matching the default.
const MEASUREMENT_FIXTURE = `{
  "state": {
    "experimentId": "exp-42",
    "experimentLabel": "Greenhouse Trial B",
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
        "content": { "params": { "averages": 3 }, "commandId": "proto-7" },
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
    "producerCellId": "node-m1",
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

const EXPECTED_WRITTEN_STATE = MEASUREMENT_STATE;
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

// The bump to v2 deliberately discards stale flows: v0 could hold a mis-seeded
// plot or stale name, v1 flowNodes carry pre-rename protocolId content. These
// run last: rehydrating a stale payload resets the singleton stores to defaults.
describe("flow stores discard stale payloads on upgrade", () => {
  it("resets the measurement flow store to initial state on v0", async () => {
    await AsyncStorage.setItem(MEASUREMENT_KEY, MEASUREMENT_V0);
    await useMeasurementFlowStore.persist.rehydrate();
    const state = useMeasurementFlowStore.getState();
    expect(state.experimentId).toBeUndefined();
    expect(state.iterationCount).toBe(0);
    expect(state.flowNodes).toEqual([]);
  });

  it("resets the measurement flow store to initial state on v1", async () => {
    await AsyncStorage.setItem(MEASUREMENT_KEY, MEASUREMENT_V1);
    await useMeasurementFlowStore.persist.rehydrate();
    const state = useMeasurementFlowStore.getState();
    expect(state.experimentId).toBeUndefined();
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
