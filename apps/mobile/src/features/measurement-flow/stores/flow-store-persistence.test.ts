import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useFlowAnswersStore } from "./use-flow-answers-store";
import {
  resetRunnerMeasurementFlowForTest,
  useMeasurementFlowStore,
} from "./use-measurement-flow-store";

const MEASUREMENT_KEY = "measurement-flow-storage";
const ANSWERS_KEY = "flow-answers-storage";
const LEGACY_V2 = JSON.stringify({
  version: 2,
  state: {
    experimentId: "legacy-experiment",
    experimentLabel: "Legacy trial",
    workbookVersionId: "legacy-version",
    workbookAttemptId: "legacy-attempt",
    workbookRunExpected: [{ producer_cell_id: "p1", device_ids: ["device-1"] }],
    workbookRunRealized: [{ producer_cell_id: "p1", device_id: "device-1", outcome: "ok" }],
    pendingWorkbookRunManifests: [],
    flowNodes: [{ id: "p1", type: "measurement" }],
    currentFlowStep: 0,
  },
});
const ANSWERS_FIXTURE = JSON.stringify({
  version: 1,
  state: {
    answersHistory: [
      { plant_id: "P-001", leaf_count: "4" },
      { plant_id: "P-002", leaf_count: "6" },
    ],
    autoincrementSettings: { plant_id: true, leaf_count: false },
    rememberAnswerSettings: { leaf_count: true, plant_id: false },
  },
});

async function readEnvelope(key: string): Promise<Record<string, unknown>> {
  const raw = await vi.waitFor(async () => {
    const value = await AsyncStorage.getItem(key);
    if (value === null) throw new Error("persist write-back has not landed yet");
    return value;
  });
  return JSON.parse(raw) as Record<string, unknown>;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  resetRunnerMeasurementFlowForTest();
  useFlowAnswersStore.getState().clearHistory();
});

describe("measurement-flow-storage v3 runner snapshot wire format", () => {
  it("persists the runner snapshot and host upload projection only", () => {
    const { partialize } = useMeasurementFlowStore.persist.getOptions();
    if (!partialize) throw new Error("store no longer configures partialize");
    const persisted = partialize(useMeasurementFlowStore.getState()) as Record<string, unknown>;
    expect(Object.keys(persisted).sort()).toEqual([
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
      "pendingWorkbookRunManifests",
      "producerCellId",
      "scanResult",
      "scanResults",
      "snapshot",
      "workbookAttemptId",
      "workbookRunExpected",
      "workbookRunRealized",
      "workbookTerminalReadyAttemptId",
      "workbookVersionId",
    ]);
  });

  it("safely discards a legacy v2 paused flow and preserves its ledger as abandoned", async () => {
    await AsyncStorage.setItem(MEASUREMENT_KEY, LEGACY_V2);
    await useMeasurementFlowStore.persist.rehydrate();
    const state = useMeasurementFlowStore.getState();

    expect(state.experimentId).toBeUndefined();
    expect(state.runnerState).toBeNull();
    expect(state.flowNodes).toEqual([]);
    expect(state.pendingWorkbookRunManifests).toHaveLength(1);
    expect(state.pendingWorkbookRunManifests[0]?.record).toMatchObject({
      workbook_attempt_id: "legacy-attempt",
      terminal_status: "abandoned",
      expected: [{ producer_cell_id: "p1", device_ids: ["device-1"] }],
    });
  });

  it("drops a half-written v3 session instead of leaving the screen stuck", async () => {
    await AsyncStorage.setItem(
      MEASUREMENT_KEY,
      JSON.stringify({ version: 3, state: { experimentId: "orphan", snapshot: undefined } }),
    );
    await useMeasurementFlowStore.persist.rehydrate();
    expect(useMeasurementFlowStore.getState().experimentId).toBeUndefined();
    expect(useMeasurementFlowStore.getState().runnerState).toBeNull();
  });
});

describe("flow-answers-storage v1 wire format", () => {
  it("rehydrates every persisted answer field", async () => {
    await AsyncStorage.setItem(ANSWERS_KEY, ANSWERS_FIXTURE);
    await useFlowAnswersStore.persist.rehydrate();
    expect(useFlowAnswersStore.getState()).toMatchObject({
      answersHistory: [
        { plant_id: "P-001", leaf_count: "4" },
        { plant_id: "P-002", leaf_count: "6" },
      ],
      autoincrementSettings: { plant_id: true, leaf_count: false },
      rememberAnswerSettings: { leaf_count: true, plant_id: false },
    });
  });

  it("round-trips the envelope unchanged through partialize", async () => {
    await AsyncStorage.setItem(ANSWERS_KEY, ANSWERS_FIXTURE);
    await useFlowAnswersStore.persist.rehydrate();
    await AsyncStorage.removeItem(ANSWERS_KEY);
    useFlowAnswersStore.setState({});
    const envelope = await readEnvelope(ANSWERS_KEY);
    expect(envelope.version).toBe(1);
    expect(envelope.state).toEqual((JSON.parse(ANSWERS_FIXTURE) as { state: unknown }).state);
  });

  it("discards pre-fix v0 answer payloads", async () => {
    await AsyncStorage.setItem(
      ANSWERS_KEY,
      JSON.stringify({
        version: 0,
        state: {
          answersHistory: [{ plot: "old" }],
          autoincrementSettings: { plot: true },
          rememberAnswerSettings: {},
        },
      }),
    );
    await useFlowAnswersStore.persist.rehydrate();
    expect(useFlowAnswersStore.getState()).toMatchObject({
      answersHistory: [],
      autoincrementSettings: {},
      rememberAnswerSettings: {},
    });
  });
});
