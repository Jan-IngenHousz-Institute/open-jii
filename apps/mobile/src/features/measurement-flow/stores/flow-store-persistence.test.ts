import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { useFlowAnswersStore } from "./use-flow-answers-store";
import { useMeasurementFlowStore } from "./use-measurement-flow-store";

// Characterization of the AsyncStorage wire format of both persisted flow
// stores. Neither declares version/migrate, so the envelope is implicitly
// version 0 and any silent shape change wipes a field researcher's paused
// flow on rehydrate. Update fixtures ONLY with a deliberate, migrated change.

const MEASUREMENT_KEY = "measurement-flow-storage";
const ANSWERS_KEY = "flow-answers-storage";

// v0 envelope for a paused mid-flow session (iteration 4, parked on the
// measurement node). Every value differs from the store default so a key
// dropped from partialize fails its per-field assert instead of matching the
// default — that's why all booleans are true, even though a live flow would
// not set all three at once.
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
    "isFromOverview": true
  },
  "version": 0
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
  "version": 0
}`;

const MEASUREMENT_STATE = (JSON.parse(MEASUREMENT_FIXTURE) as { state: Record<string, unknown> })
  .state;
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

describe("measurement-flow-storage v0 wire format", () => {
  beforeAll(async () => {
    await AsyncStorage.setItem(MEASUREMENT_KEY, MEASUREMENT_FIXTURE);
    await useMeasurementFlowStore.persist.rehydrate();
  });

  it.each(Object.keys(MEASUREMENT_STATE))("rehydrates persisted field %s", (key) => {
    const state = useMeasurementFlowStore.getState() as unknown as Record<string, unknown>;
    expect(state[key]).toEqual(MEASUREMENT_STATE[key]);
  });

  it("round-trips the envelope unchanged through partialize", async () => {
    await AsyncStorage.removeItem(MEASUREMENT_KEY);
    useMeasurementFlowStore.setState({}); // identity write still runs partialize + setItem
    const envelope = await readEnvelope(MEASUREMENT_KEY);
    expect(Object.keys(envelope).sort()).toEqual(["state", "version"]);
    expect(envelope.version).toBe(0);
    expect(envelope.state).toEqual(MEASUREMENT_STATE);
  });

  it("persists exactly the known field set", () => {
    const { partialize } = useMeasurementFlowStore.persist.getOptions();
    if (!partialize) throw new Error("store no longer configures partialize");
    const persisted = partialize(useMeasurementFlowStore.getState()) as Record<string, unknown>;
    // Adding a persisted field must update this list AND the fixture above.
    expect(Object.keys(persisted).sort()).toEqual([
      "currentFlowStep",
      "currentStep",
      "experimentId",
      "experimentLabel",
      "flowNodes",
      "isFlowFinished",
      "isFromOverview",
      "isQuestionsSubmitPending",
      "iterationCount",
      "protocolId",
      "scanResult",
    ]);
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
