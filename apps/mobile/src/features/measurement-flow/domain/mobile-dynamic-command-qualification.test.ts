import AsyncStorage from "@react-native-async-storage/async-storage";
import { afterEach, describe, expect, it, vi } from "vitest";
import { installFlowRehydrationGuard } from "~/features/measurement-flow/stores/flow-rehydration-guard";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

import { commandFailureLogFields, resolveMobileCommand } from "./mobile-command-resolution";
import type { MobileCommandResolutionResult } from "./mobile-command-resolution";

/**
 * Ticket 7 cross-host qualification, mobile host. Drives the real persisted
 * stores and the mobile resolver adapter through the canonical flow
 * (protocol -> per-device macro { toDevice } -> ref command -> reply) plus the
 * cycle-lifecycle cases: retry, restart resume, v1 migration, malformed
 * resume state, workbook-version change, and reconnect identity change.
 */

const FLOW_KEY = "measurement-flow-storage";
const ANSWERS_KEY = "flow-answers-storage";
const uuid = "11111111-1111-1111-1111-111111111111";
const DEVICE_A = "multispeq-serial-a";
const DEVICE_B = "multispeq-serial-b";

const canonicalCells: WorkbookCell[] = [
  {
    id: "protocol-1",
    type: "protocol",
    isCollapsed: false,
    payload: { protocolId: uuid, version: 1, name: "SPAD" },
  },
  {
    id: "macro-1",
    type: "macro",
    isCollapsed: false,
    payload: { macroId: uuid, language: "python", name: "Compute calibration" },
  },
  {
    id: "command-1",
    type: "command",
    isCollapsed: false,
    payload: { kind: "ref", ref: { sourceCellId: "macro-1", field: "toDevice" } },
  },
  {
    id: "command-2",
    type: "command",
    isCollapsed: false,
    payload: { kind: "ref", ref: { sourceCellId: "command-1", field: "response" } },
  },
];

const questionCells: WorkbookCell[] = [
  {
    id: "question-1",
    type: "question",
    isCollapsed: false,
    name: "Calibration constant",
    question: { kind: "open_ended", text: "Which constant?", required: false },
    isAnswered: true,
  },
  {
    id: "command-1",
    type: "command",
    isCollapsed: false,
    payload: { kind: "ref", ref: { sourceCellId: "question-1", field: "answer" } },
  },
];

function startCycle(cells: WorkbookCell[], workbookVersionId = "version-1"): void {
  const store = useMeasurementFlowStore.getState();
  store.setExperimentId("experiment-1", "Experiment 1");
  store.setFlowGraph([], [], cells, workbookVersionId, "experiment-1");
}

function resolveFor(commandCellId: string, targetDeviceId: string): MobileCommandResolutionResult {
  const state = useMeasurementFlowStore.getState();
  return resolveMobileCommand({
    commandCellId,
    cells: state.cells,
    targetDeviceId,
    workbookVersionId: state.workbookVersionId,
    executionEpoch: state.executionEpoch,
    getRuntimeCellOutput: state.getRuntimeCellOutput,
  });
}

/** Resolve for each device and dispatch only ok values, like the capture hook. */
function runCommandCell(
  commandCellId: string,
  targetDeviceIds: string[],
  transport: (deviceId: string, value: unknown) => unknown,
): MobileCommandResolutionResult[] {
  const resolutions = targetDeviceIds.map((deviceId) => resolveFor(commandCellId, deviceId));
  const replies = targetDeviceIds.flatMap((deviceId, index) => {
    const resolution = resolutions[index];
    if (!resolution.ok) return [];
    return [{ device: { id: deviceId }, data: transport(deviceId, resolution.value) }];
  });
  if (replies.length > 0) {
    useMeasurementFlowStore
      .getState()
      .recordDeviceProducerOutcomes(commandCellId, "command", replies);
  }
  return resolutions;
}

afterEach(async () => {
  useMeasurementFlowStore.getState().resetFlow();
  useFlowAnswersStore.getState().clearHistory();
  await AsyncStorage.removeItem(FLOW_KEY);
  await AsyncStorage.removeItem(ANSWERS_KEY);
});

describe("mobile qualification: canonical dynamic command chain", () => {
  it("completes protocol -> macro { toDevice } -> ref command -> reply and chains the reply", () => {
    startCycle(canonicalCells);
    const store = useMeasurementFlowStore.getState();

    store.recordDeviceProducerOutcomes("protocol-1", "protocol", [
      { device: { id: DEVICE_A, name: "MultispeQ A" }, data: { spad: 41.5 } },
    ]);
    store.setMacroOutput("macro-1", { toDevice: "set_calibration 41.5" }, { id: DEVICE_A });

    const transport = vi.fn((deviceId: string) => ({ response: `ack:${deviceId}` }));
    const first = runCommandCell("command-1", [DEVICE_A], transport);
    expect(first).toEqual([{ ok: true, value: "set_calibration 41.5" }]);
    expect(transport).toHaveBeenCalledExactlyOnceWith(DEVICE_A, "set_calibration 41.5");

    // The recorded reply is the later command's source.
    const chained = runCommandCell("command-2", [DEVICE_A], transport);
    expect(chained).toEqual([{ ok: true, value: `ack:${DEVICE_A}` }]);
  });

  it("gives each of two devices only its own computed string", () => {
    startCycle(canonicalCells);
    const store = useMeasurementFlowStore.getState();
    store.setMacroOutput("macro-1", { toDevice: "set_calibration 41.5" }, { id: DEVICE_A });
    store.setMacroOutput("macro-1", { toDevice: "set_calibration 38.2" }, { id: DEVICE_B });

    expect(resolveFor("command-1", DEVICE_A)).toEqual({ ok: true, value: "set_calibration 41.5" });
    expect(resolveFor("command-1", DEVICE_B)).toEqual({ ok: true, value: "set_calibration 38.2" });
  });

  it("fans the shared question answer out to both devices unchanged", () => {
    startCycle(questionCells);
    useFlowAnswersStore.getState().setAnswer(0, "question-1", "set_led 4");

    expect(resolveFor("command-1", DEVICE_A)).toEqual({ ok: true, value: "set_led 4" });
    expect(resolveFor("command-1", DEVICE_B)).toEqual({ ok: true, value: "set_led 4" });
  });

  it("pre-fails a reconnected device under a new id until its source reruns", () => {
    startCycle(canonicalCells);
    useMeasurementFlowStore
      .getState()
      .setMacroOutput("macro-1", { toDevice: "value" }, { id: DEVICE_A });

    const reconnectedId = `${DEVICE_A}-reconnected`;
    expect(resolveFor("command-1", reconnectedId)).toMatchObject({
      ok: false,
      error: { code: "DEVICE_OUTPUT_MISSING", targetDeviceId: reconnectedId },
    });

    // Rerunning the source for the new identity repairs that device only.
    useMeasurementFlowStore
      .getState()
      .setMacroOutput("macro-1", { toDevice: "value" }, { id: reconnectedId });
    expect(resolveFor("command-1", reconnectedId)).toEqual({ ok: true, value: "value" });
  });
});

describe("mobile qualification: cycle lifecycle invalidation", () => {
  it.each([
    ["retry", () => useMeasurementFlowStore.getState().retryCurrentIteration()],
    ["new iteration", () => useMeasurementFlowStore.getState().startNewIteration()],
  ])("%s starts a fresh epoch and blocks the prior cycle's outputs", (_label, transition) => {
    startCycle(canonicalCells);
    useMeasurementFlowStore
      .getState()
      .setMacroOutput("macro-1", { toDevice: "value" }, { id: DEVICE_A });
    const priorEpoch = useMeasurementFlowStore.getState().executionEpoch;

    transition();

    expect(useMeasurementFlowStore.getState().executionEpoch).not.toBe(priorEpoch);
    expect(resolveFor("command-1", DEVICE_A)).toMatchObject({
      ok: false,
      error: { code: "COMMAND_OUTPUT_MISSING" },
    });
  });

  it("a workbook-version change clears outputs and answers before execution", () => {
    startCycle(canonicalCells, "version-1");
    useMeasurementFlowStore
      .getState()
      .setMacroOutput("macro-1", { toDevice: "value" }, { id: DEVICE_A });
    useFlowAnswersStore.getState().setAnswer(0, "question-1", "stale answer");

    startCycle(canonicalCells, "version-2");

    const state = useMeasurementFlowStore.getState();
    expect(state.outputsByCellId).toEqual({});
    expect(useFlowAnswersStore.getState().answersHistory).toEqual([]);
    expect(resolveFor("command-1", DEVICE_A)).toMatchObject({
      ok: false,
      error: { code: "COMMAND_OUTPUT_MISSING" },
    });
  });

  it("a same-version refetch preserves the active cycle's outputs", () => {
    startCycle(canonicalCells, "version-1");
    useMeasurementFlowStore
      .getState()
      .setMacroOutput("macro-1", { toDevice: "value" }, { id: DEVICE_A });

    useMeasurementFlowStore
      .getState()
      .setFlowGraph([], [], canonicalCells, "version-1", "experiment-1");

    expect(resolveFor("command-1", DEVICE_A)).toEqual({ ok: true, value: "value" });
  });
});

describe("mobile qualification: restart, migration, and resume guard", () => {
  it("resumes the full chain from a persisted active cycle after an app restart", async () => {
    await AsyncStorage.setItem(
      FLOW_KEY,
      JSON.stringify({
        version: 2,
        state: {
          experimentId: "experiment-1",
          loadedExperimentId: "experiment-1",
          workbookVersionId: "version-1",
          executionEpoch: "epoch-resumed",
          cells: canonicalCells,
          outputsByCellId: {
            "macro-1": {
              scope: "device",
              provenance: { workbookVersionId: "version-1", executionEpoch: "epoch-resumed" },
              deviceResults: [{ deviceId: DEVICE_A, data: { toDevice: "set_calibration 41.5" } }],
            },
          },
        },
      }),
    );
    await useMeasurementFlowStore.persist.rehydrate();

    const transport = vi.fn((deviceId: string) => ({ response: `ack:${deviceId}` }));
    expect(runCommandCell("command-1", [DEVICE_A], transport)).toEqual([
      { ok: true, value: "set_calibration 41.5" },
    ]);
    expect(runCommandCell("command-2", [DEVICE_A], transport)).toEqual([
      { ok: true, value: `ack:${DEVICE_A}` },
    ]);
  });

  it("migrates a valid v1 cycle into a guard-accepted, resolver-visible v2 state", async () => {
    await AsyncStorage.setItem(
      FLOW_KEY,
      JSON.stringify({
        version: 1,
        state: {
          experimentId: "experiment-1",
          workbookVersionId: "version-1",
          cells: canonicalCells.slice(0, 2),
          flowNodes: [],
          edges: [],
          currentFlowStep: 1,
          iterationCount: 0,
          branchVisitCounts: {},
          consumedNodeIds: [],
          cellOutputs: { "macro-1": { toDevice: "set_calibration 41.5" } },
          producerCellId: "protocol-1",
          scanResults: [{ result: { spad: 41.5 }, device: { id: DEVICE_A, name: "MultispeQ A" } }],
        },
      }),
    );
    await useMeasurementFlowStore.persist.rehydrate();
    const uninstall = installFlowRehydrationGuard();
    uninstall();

    const state = useMeasurementFlowStore.getState();
    expect(state.resumeResetReason).toBeUndefined();
    expect(state.executionEpoch).toBeTruthy();
    expect(state.getRuntimeCellOutput("macro-1")).toMatchObject({ scope: "shared" });
    expect(state.getRuntimeCellOutput("protocol-1")).toMatchObject({
      scope: "device",
      deviceResults: [expect.objectContaining({ deviceId: DEVICE_A })],
    });
  });

  it("resets both stores on malformed resume state instead of exposing an ambiguous value", async () => {
    await AsyncStorage.setItem(
      FLOW_KEY,
      JSON.stringify({
        version: 2,
        state: {
          experimentId: "experiment-1",
          loadedExperimentId: "experiment-1",
          workbookVersionId: "version-1",
          executionEpoch: "epoch-live",
          cells: canonicalCells,
          outputsByCellId: {
            "macro-1": {
              scope: "device",
              // Cross-cycle contamination: entry epoch differs from the state epoch.
              provenance: { workbookVersionId: "version-1", executionEpoch: "epoch-other" },
              deviceResults: [{ deviceId: DEVICE_A, data: { toDevice: "ambiguous" } }],
            },
          },
        },
      }),
    );
    await useMeasurementFlowStore.persist.rehydrate();
    const uninstall = installFlowRehydrationGuard();
    uninstall();

    const state = useMeasurementFlowStore.getState();
    expect(state.resumeResetReason).toBe("FLOW_RESUME_STATE_INVALID");
    expect(state.outputsByCellId).toEqual({});
    expect(resolveFor("command-1", DEVICE_A)).toMatchObject({
      ok: false,
      error: { code: "COMMAND_PROVENANCE_MISSING" },
    });
  });
});

describe("mobile qualification: telemetry safety", () => {
  it("failure log fields carry identifiers and codes only, never resolved values", () => {
    startCycle(canonicalCells);
    const secret = "set_calibration 41.5 SECRET-CONSTANT";
    useMeasurementFlowStore
      .getState()
      .setMacroOutput("macro-1", { toDevice: secret }, { id: DEVICE_A });

    const resolution = resolveFor("command-1", DEVICE_B);
    expect(resolution.ok).toBe(false);
    if (resolution.ok) return;

    const state = useMeasurementFlowStore.getState();
    const fields = commandFailureLogFields("direct", resolution.error, {
      workbookVersionId: state.workbookVersionId,
      executionEpoch: state.executionEpoch,
    });
    expect(Object.keys(fields).sort()).toEqual([
      "code",
      "commandCellId",
      "executionEpoch",
      "operation",
      "sourceCellId",
      "targetDeviceId",
      "workbookVersionId",
    ]);
    expect(JSON.stringify(fields)).not.toContain(secret);
    expect(JSON.stringify(resolution.error)).not.toContain(secret);
  });
});
