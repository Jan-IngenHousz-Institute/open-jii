import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { useFlowAnswersStore } from "./use-flow-answers-store";
import { migrateMeasurementFlowState, useMeasurementFlowStore } from "./use-measurement-flow-store";

// Characterization of the AsyncStorage wire format of both persisted flow
// stores (pinned at version 2). A silent shape change wipes a field
// researcher's paused flow on rehydrate. v2 migrates attributable v1 outputs
// into strict envelopes while deliberately discarding pre-fix v0
// payloads; update fixtures ONLY with a deliberate change or a version bump.

const MEASUREMENT_KEY = "measurement-flow-storage";
const ANSWERS_KEY = "flow-answers-storage";

// A pre-fix v0 envelope for each store: rehydrating it must reset to defaults.
const MEASUREMENT_V0 = `{ "state": { "experimentId": "old-exp", "iterationCount": 5 }, "version": 0 }`;
const ANSWERS_V0 = `{ "state": { "answersHistory": [{ "plot": "old" }], "autoincrementSettings": { "plot": true }, "rememberAnswerSettings": {} }, "version": 0 }`;

// Real serialized v1 envelope for a paused mid-flow session.
// Every value differs from the store default so a key dropped from partialize
// fails its per-field assert instead of silently matching the default.
const MEASUREMENT_FIXTURE = `{
  "state": {
    "experimentId": "exp-42",
    "experimentLabel": "Greenhouse Trial B",
    "workbookVersionId": "version-17",
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

// v1 envelope after two completed answer iterations with per-question
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
const LEGACY_ONLY_KEYS = ["protocolId", "cellOutputs"];
const EXPECTED_PRESERVED_STATE = Object.fromEntries(
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

describe("measurement-flow-storage v1 -> v2 migration", () => {
  beforeAll(async () => {
    await AsyncStorage.setItem(MEASUREMENT_KEY, MEASUREMENT_FIXTURE);
    await useMeasurementFlowStore.persist.rehydrate();
  });

  it.each(Object.keys(EXPECTED_PRESERVED_STATE))("preserves persisted field %s", (key) => {
    const state = useMeasurementFlowStore.getState() as unknown as Record<string, unknown>;
    expect(state[key]).toEqual(MEASUREMENT_STATE[key]);
  });

  it("adds cycle identity and migrates only attributable producer outputs", () => {
    const state = useMeasurementFlowStore.getState();
    expect(state.loadedExperimentId).toBe("exp-42");
    expect(state.executionEpoch).toEqual(expect.any(String));
    expect(state.outputsByCellId).toEqual({
      "node-m1": {
        scope: "device",
        provenance: {
          workbookVersionId: "version-17",
          executionEpoch: state.executionEpoch,
        },
        deviceResults: [
          {
            deviceId: "1002",
            deviceLabel: "MultispeQ #1002",
            data: { device_name: "MultispeQ v2.0", spad: [41.2, 39.8] },
          },
        ],
      },
      "node-a1": {
        scope: "shared",
        provenance: {
          workbookVersionId: "version-17",
          executionEpoch: state.executionEpoch,
        },
        data: { spad_avg: 40.5 },
      },
    });
  });

  it("keeps ambiguous legacy scans visible but non-resolvable", () => {
    const fixture = JSON.parse(MEASUREMENT_FIXTURE) as { state: Record<string, unknown> };
    fixture.state.scanResults = [{ result: { sample: [{ phi2: 0.5 }] } }];
    const migrated = migrateMeasurementFlowState(fixture.state, 1, () => "epoch-fixed") as {
      scanResults: unknown[];
      outputsByCellId: Record<string, unknown>;
    };
    expect(migrated.scanResults).toHaveLength(1);
    expect(migrated.outputsByCellId).not.toHaveProperty("node-m1");
    expect(migrated.outputsByCellId).toHaveProperty("node-a1");
  });

  it("migrates an attributed scan with an exact id even without a display name", () => {
    const fixture = JSON.parse(MEASUREMENT_FIXTURE) as { state: Record<string, unknown> };
    fixture.state.scanResults = [
      { device: { id: "device-exact" }, result: { sample: [{ phi2: 0.5 }] } },
    ];
    const migrated = migrateMeasurementFlowState(fixture.state, 1, () => "epoch-fixed") as {
      outputsByCellId: Record<string, unknown>;
    };
    expect(migrated.outputsByCellId["node-m1"]).toEqual({
      scope: "device",
      provenance: { workbookVersionId: "version-17", executionEpoch: "epoch-fixed" },
      deviceResults: [{ deviceId: "device-exact", data: { phi2: 0.5 } }],
    });
  });

  it("preserves the active epoch and registry across a v2 restart", async () => {
    const { partialize } = useMeasurementFlowStore.persist.getOptions();
    if (!partialize) throw new Error("store no longer configures partialize");
    const before = useMeasurementFlowStore.getState();
    const envelope = JSON.stringify({ state: partialize(before), version: 2 });
    await AsyncStorage.setItem(MEASUREMENT_KEY, envelope);

    await useMeasurementFlowStore.persist.rehydrate();

    expect(useMeasurementFlowStore.getState().executionEpoch).toBe(before.executionEpoch);
    expect(useMeasurementFlowStore.getState().outputsByCellId).toEqual(before.outputsByCellId);
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
    const { partialize } = useMeasurementFlowStore.persist.getOptions();
    if (!partialize) throw new Error("store no longer configures partialize");
    expect(envelope.state).toEqual(partialize(useMeasurementFlowStore.getState()));
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
      "executionEpoch",
      "experimentId",
      "experimentLabel",
      "flowNodes",
      "isFlowFinished",
      "isFromOverview",
      "isQuestionsSubmitPending",
      "iterationCount",
      "lastMatchedPath",
      "loadedExperimentId",
      "outputsByCellId",
      "producerCellId",
      "scanResult",
      "scanResults",
      "workbookVersionId",
    ]);
  });
});

describe("flow-answers-storage v1 -> v2 identity migration", () => {
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
    expect(envelope.version).toBe(2);
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
