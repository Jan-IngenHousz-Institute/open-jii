import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hydrateFlowNodes } from "~/features/measurement-flow/utils/hydrate-flow-nodes";
import type { FlowNode } from "~/shared/measurements/flow-node";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import { cellsToFlowGraph } from "@repo/api/transforms/cells-to-flow";

import { useFlowAnswersStore } from "./use-flow-answers-store";
import {
  flushRunnerMeasurementFlowSnapshot,
  resetRunnerMeasurementFlowForTest,
  useMeasurementFlowStore,
} from "./use-measurement-flow-store";

const scanner = vi.hoisted(() => {
  const listeners = new Set<(state: ScannerState, previous: ScannerState) => void>();
  interface ScannerState {
    executors: Map<string, ReturnType<typeof entry>>;
    executeCommandOn: Mock<
      (deviceId: string, payload: unknown, options?: { timeoutMs?: number }) => Promise<object>
    >;
    cancelCommandOn: Mock<(deviceId: string) => Promise<void>>;
  }
  function entry(id: string, family: "multispeq" | "ambit" = "multispeq") {
    return {
      device: { id, name: `Device ${id}`, type: "usb" as const },
      identity: {
        family,
        name: family === "ambit" ? "Ambit" : "MultispeQ v2",
        deviceId: `firmware-${id}`,
        raw: {},
      },
      executor: { onProgress: vi.fn(() => vi.fn()) },
      isExecuting: false,
      isCancelled: false,
      error: undefined,
      commandResponse: undefined,
      progress: undefined,
      scanStartedAt: undefined,
      estimatedMs: undefined,
    };
  }
  const state: ScannerState = {
    executors: new Map(),
    executeCommandOn:
      vi.fn<
        (deviceId: string, payload: unknown, options?: { timeoutMs?: number }) => Promise<object>
      >(),
    cancelCommandOn: vi.fn<(deviceId: string) => Promise<void>>(() => Promise.resolve()),
  };
  const hook = Object.assign(
    vi.fn((selector: (value: ScannerState) => unknown) => selector(state)),
    {
      getState: () => state,
      subscribe: (listener: (value: ScannerState, previous: ScannerState) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
  );
  return { state, entry, hook, listeners };
});

vi.mock("~/features/connection/stores/use-scanner-command-executor-store", () => ({
  useScannerCommandExecutorStore: scanner.hook,
}));
vi.mock("~/features/measurement-flow/utils/play-sound", () => ({
  playSound: () => Promise.resolve(),
}));

const question = (id: string): WorkbookCell => ({
  id,
  type: "question",
  isCollapsed: false,
  name: id,
  question: { kind: "open_ended", text: `${id}?`, required: false },
  isAnswered: false,
});
const instruction = (id: string): WorkbookCell => ({
  id,
  type: "markdown",
  isCollapsed: false,
  content: id,
});
const command = (id: string, content = id): WorkbookCell => ({
  id,
  type: "command",
  isCollapsed: false,
  payload: { format: "string", content },
});
const protocol = (id: string, protocolId = `protocol-${id}`): WorkbookCell => ({
  id,
  type: "protocol",
  isCollapsed: false,
  payload: { protocolId, version: 1, name: id },
});

function connect(...devices: [string, "multispeq" | "ambit"][]) {
  scanner.state.executors = new Map(
    devices.map(([id, family]) => [id, scanner.entry(id, family)] as const),
  );
}

async function start(cells: WorkbookCell[], protocolCodes: Record<string, object[]> = {}) {
  const graph = cellsToFlowGraph(cells);
  const nodes = hydrateFlowNodes(graph.nodes as FlowNode[], cells, {
    protocols: Object.fromEntries(
      Object.entries(protocolCodes).map(([id, code]) => [id, { code, family: "multispeq" }]),
    ),
    macros: {},
  });
  useMeasurementFlowStore.getState().setFlowGraph(nodes, graph.edges, cells, "version-1");
  useMeasurementFlowStore.getState().setExperimentId("experiment-1", "Experiment");
  await waitForMicrotasks(() =>
    expect(useMeasurementFlowStore.getState().runnerState).not.toBeNull(),
  );
}

function setAnswer(cellId: string, value: string, targetIndex: number) {
  const state = useMeasurementFlowStore.getState();
  useFlowAnswersStore.getState().setAnswer(state.iterationCount, cellId, value);
  if (targetIndex >= state.flowNodes.length) state.nextStep();
  else state.setCurrentFlowStep(targetIndex);
}

async function waitForMicrotasks<T>(assertion: () => T | Promise<T>): Promise<Awaited<T>> {
  let lastError: unknown;
  for (let index = 0; index < 200; index += 1) {
    try {
      return await assertion();
    } catch (error) {
      lastError = error;
      await Promise.resolve();
    }
  }
  throw lastError;
}

beforeEach(async () => {
  vi.clearAllMocks();
  scanner.state.executeCommandOn.mockReset();
  scanner.state.cancelCommandOn.mockReset().mockResolvedValue(undefined);
  await AsyncStorage.clear();
  resetRunnerMeasurementFlowForTest();
  useFlowAnswersStore.getState().clearHistory();
  connect();
});

afterEach(() => resetRunnerMeasurementFlowForTest());

describe("runner-backed mobile qualification matrix", () => {
  it("runs one protocol concurrently on every connected device", async () => {
    connect(["a", "multispeq"], ["b", "ambit"]);
    const calls: string[] = [];
    scanner.state.executeCommandOn.mockImplementation((deviceId: string) => {
      calls.push(deviceId);
      return Promise.resolve({ device_id: `firmware-${deviceId}`, value: deviceId });
    });
    await start([protocol("p1"), instruction("done")], { "protocol-p1": [{ scan: true }] });

    useMeasurementFlowStore.getState().startRunnerScan("p1");
    await waitForMicrotasks(() =>
      expect(useMeasurementFlowStore.getState().currentFlowStep).toBe(1),
    );

    expect(calls).toEqual(["a", "b"]);
    expect(useMeasurementFlowStore.getState().scanResults).toEqual([
      expect.objectContaining({
        device: expect.objectContaining({ id: "a" }),
        producerCellId: "p1",
      }),
      expect.objectContaining({
        device: expect.objectContaining({ id: "b" }),
        producerCellId: "p1",
      }),
    ]);
  });

  it("starts heterogeneous assignments together and preserves each producer", async () => {
    connect(["a", "multispeq"], ["b", "ambit"]);
    const releases = new Map<string, (value: object) => void>();
    scanner.state.executeCommandOn.mockImplementation(
      (deviceId: string, payload: unknown) =>
        new Promise((resolve) => {
          releases.set(`${deviceId}:${String(payload)}`, resolve);
        }),
    );
    const branch: WorkbookCell = {
      id: "branch",
      type: "branch",
      isCollapsed: false,
      paths: [
        {
          id: "multi",
          label: "Multi",
          color: "#0a0",
          conditions: [
            {
              id: "multi-family",
              sourceCellId: "$device",
              field: "family",
              operator: "eq",
              value: "multispeq",
            },
          ],
          gotoCellId: "command-a",
        },
        {
          id: "ambit",
          label: "Ambit",
          color: "#00a",
          conditions: [
            {
              id: "ambit-family",
              sourceCellId: "$device",
              field: "family",
              operator: "eq",
              value: "ambit",
            },
          ],
          gotoCellId: "command-b",
        },
      ],
    };
    await start([
      branch,
      command("command-a", "PAYLOAD-A"),
      command("command-b", "PAYLOAD-B"),
      instruction("done"),
    ]);

    expect(
      Object.values(useMeasurementFlowStore.getState().runnerState?.inFlight ?? {}).map(
        (effect) => effect?.cellId,
      ),
    ).toEqual(["command-a", "command-b"]);
    expect(useMeasurementFlowStore.getState().runnerState?.tracks.main.dispatch?.queue).toEqual([
      { targetCellId: "command-a", deviceIds: ["a"] },
      { targetCellId: "command-b", deviceIds: ["b"] },
    ]);
    await waitForMicrotasks(() =>
      expect(useMeasurementFlowStore.getState().awaitingScanStart).toBe(true),
    );

    useMeasurementFlowStore.getState().startRunnerScan("command-a");
    await waitForMicrotasks(() => expect(releases.size).toBe(2));
    expect([...releases.keys()]).toEqual(["a:PAYLOAD-A", "b:PAYLOAD-B"]);
    releases.get("b:PAYLOAD-B")?.({ device_id: "firmware-b", value: "B" });
    for (let index = 0; index < 10; index += 1) await Promise.resolve();
    expect(useMeasurementFlowStore.getState().scanResults?.map(({ device }) => device?.id)).toEqual(
      ["b"],
    );
    releases.get("a:PAYLOAD-A")?.({ device_id: "firmware-a", value: "A" });
    for (let index = 0; index < 20; index += 1) await Promise.resolve();
    expect(useMeasurementFlowStore.getState().currentFlowStep).toBe(3);

    expect(useMeasurementFlowStore.getState().scanResults).toEqual([
      expect.objectContaining({
        device: expect.objectContaining({ id: "a" }),
        producerCellId: "command-a",
      }),
      expect.objectContaining({
        device: expect.objectContaining({ id: "b" }),
        producerCellId: "command-b",
      }),
    ]);
  });

  it("accumulates success and retries only the failed device", async () => {
    connect(["a", "multispeq"], ["b", "multispeq"]);
    const calls: string[] = [];
    let bAttempts = 0;
    scanner.state.executeCommandOn.mockImplementation((deviceId: string) => {
      calls.push(deviceId);
      if (deviceId === "b" && bAttempts++ === 0) return Promise.reject(new Error("unplugged"));
      return Promise.resolve({ device_id: `firmware-${deviceId}`, value: deviceId });
    });
    await start([protocol("p1"), instruction("done")], { "protocol-p1": [{ scan: true }] });

    useMeasurementFlowStore.getState().startRunnerScan("p1");
    await waitForMicrotasks(() =>
      expect(useMeasurementFlowStore.getState().runnerScanRound?.failures).toHaveLength(1),
    );
    expect(useMeasurementFlowStore.getState().runnerSucceededCount).toBe(1);
    useMeasurementFlowStore.getState().startRunnerScan("p1");
    await waitForMicrotasks(() =>
      expect(useMeasurementFlowStore.getState().currentFlowStep).toBe(1),
    );

    expect(calls).toEqual(["a", "b", "b"]);
    expect(useMeasurementFlowStore.getState().workbookRunRealized).toEqual([
      expect.objectContaining({ device_id: "firmware-a", outcome: "ok" }),
      expect.objectContaining({ device_id: "firmware-b", outcome: "ok" }),
    ]);
  });

  it("cancels every targeted in-flight command", async () => {
    connect(["a", "multispeq"], ["b", "multispeq"]);
    scanner.state.executeCommandOn.mockImplementation(() => new Promise(() => undefined));
    await start([protocol("p1"), instruction("done")], { "protocol-p1": [{ scan: true }] });
    useMeasurementFlowStore.getState().startRunnerScan("p1");
    await waitForMicrotasks(() => expect(scanner.state.executeCommandOn).toHaveBeenCalledTimes(2));

    useMeasurementFlowStore.getState().cancelRunnerScan();
    await waitForMicrotasks(() => expect(scanner.state.cancelCommandOn).toHaveBeenCalledTimes(2));
    expect(scanner.state.cancelCommandOn.mock.calls.map(([id]) => id)).toEqual(["a", "b"]);
  });

  it("wraps iterations, retains the prior scan, and supports Back over a branch jump", async () => {
    connect(["a", "multispeq"]);
    scanner.state.executeCommandOn.mockResolvedValue({ device_id: "firmware-a", value: 1 });
    await start([question("q1"), command("measure"), instruction("end")]);
    setAnswer("q1", "go", 1);
    await waitForMicrotasks(() =>
      expect(useMeasurementFlowStore.getState().awaitingScanStart).toBe(true),
    );
    useMeasurementFlowStore.getState().startRunnerScan("measure");
    await waitForMicrotasks(() =>
      expect(useMeasurementFlowStore.getState().currentFlowStep).toBe(2),
    );
    const priorScan = useMeasurementFlowStore.getState().scanResult;
    useMeasurementFlowStore.getState().nextStep();
    await waitForMicrotasks(() =>
      expect(useMeasurementFlowStore.getState().iterationCount).toBe(1),
    );
    expect(useMeasurementFlowStore.getState().scanResult).toBe(priorScan);

    resetRunnerMeasurementFlowForTest();
    const branch: WorkbookCell = {
      id: "branch",
      type: "branch",
      isCollapsed: false,
      paths: [
        {
          id: "skip",
          label: "Skip",
          color: "#0a0",
          conditions: [
            { id: "answer", sourceCellId: "route", field: "answer", operator: "eq", value: "skip" },
          ],
          gotoCellId: "q3",
        },
      ],
    };
    await start([question("route"), branch, question("q2"), question("q3")]);
    setAnswer("route", "skip", 3);
    await waitForMicrotasks(() =>
      expect(useMeasurementFlowStore.getState().currentFlowStep).toBe(3),
    );
    useMeasurementFlowStore.getState().previousStep();
    expect(useMeasurementFlowStore.getState().currentFlowStep).toBe(0);
  });

  it("keeps attempt grouping and per-device firmware provenance", async () => {
    connect(["transport-a", "multispeq"], ["transport-b", "multispeq"]);
    scanner.state.executeCommandOn.mockImplementation((deviceId: string) =>
      Promise.resolve({
        device_id: `row-${deviceId}`,
        value: deviceId,
      }),
    );
    await start([protocol("p1"), instruction("done")], { "protocol-p1": [{ scan: true }] });
    const attemptId = useMeasurementFlowStore.getState().workbookAttemptId;
    useMeasurementFlowStore.getState().startRunnerScan("p1");
    await waitForMicrotasks(() =>
      expect(useMeasurementFlowStore.getState().currentFlowStep).toBe(1),
    );

    const state = useMeasurementFlowStore.getState();
    expect(state.workbookAttemptId).toBe(attemptId);
    expect(state.scanResults?.map(({ measurementDeviceId }) => measurementDeviceId)).toEqual([
      "row-transport-a",
      "row-transport-b",
    ]);
    expect(
      state.workbookRunRealized.flatMap((entry) => ("device_id" in entry ? [entry.device_id] : [])),
    ).toEqual(["row-transport-a", "row-transport-b"]);
  });

  it("restores a parked snapshot offline without auto-sending a command", async () => {
    connect(["a", "multispeq"]);
    await start([protocol("p1"), instruction("done")], { "protocol-p1": [{ scan: true }] });
    flushRunnerMeasurementFlowSnapshot();
    const persisted = await waitForMicrotasks(async () => {
      const value = await AsyncStorage.getItem("measurement-flow-storage");
      if (!value) throw new Error("snapshot not persisted yet");
      return value;
    });

    resetRunnerMeasurementFlowForTest();
    await AsyncStorage.setItem("measurement-flow-storage", persisted);
    await useMeasurementFlowStore.persist.rehydrate();
    await waitForMicrotasks(() =>
      expect(useMeasurementFlowStore.getState().runnerState).not.toBeNull(),
    );

    expect(useMeasurementFlowStore.getState()).toMatchObject({
      experimentId: "experiment-1",
      currentFlowStep: 0,
    });
    expect(useMeasurementFlowStore.getState().runnerState?.cellRuns.p1?.status).toBe("interrupted");
    expect(scanner.state.executeCommandOn).not.toHaveBeenCalled();
  });

  it("maps questions-only completion to review, Back, and the next cycle", async () => {
    await start([question("q1")]);
    setAnswer("q1", "Alice", 1);
    await waitForMicrotasks(() =>
      expect(useMeasurementFlowStore.getState().isQuestionsSubmitPending).toBe(true),
    );
    expect(useMeasurementFlowStore.getState().currentFlowStep).toBe(1);

    useMeasurementFlowStore.getState().previousStep();
    expect(useMeasurementFlowStore.getState().currentFlowStep).toBe(0);
    expect(useMeasurementFlowStore.getState().runnerState?.tracks.main).toMatchObject({
      status: "awaitingHuman",
      pendingInteraction: { kind: "question", cellId: "q1" },
    });
    setAnswer("q1", "Alice", 1);
    await waitForMicrotasks(() =>
      expect(useMeasurementFlowStore.getState().isQuestionsSubmitPending).toBe(true),
    );
    useMeasurementFlowStore.getState().dismissQuestionsSubmit();
    expect(useMeasurementFlowStore.getState().iterationCount).toBe(1);
    expect(useMeasurementFlowStore.getState().currentFlowStep).toBe(0);
  });
});
