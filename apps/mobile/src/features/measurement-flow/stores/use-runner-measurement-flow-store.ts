import AsyncStorage from "@react-native-async-storage/async-storage";
import { v4 as uuidv4 } from "uuid";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { MultiScanRound } from "~/features/connection/services/scan-manager/execute-scan-assignments";
import type { DeviceExecutorEntry } from "~/features/connection/stores/use-scanner-command-executor-store";
import type {
  FlowState,
  MatchedPath,
  ScanResult,
  ScanResultEntry,
} from "~/features/measurement-flow/domain/flow-state";
import { initialFlowState } from "~/features/measurement-flow/domain/flow-state";
import { isQuestionsOnlyFlow } from "~/shared/measurements/flow-node";
import { resolveMeasurementDeviceId } from "~/shared/measurements/measurement-device-id";
import { createLogger } from "~/shared/observability/logger";

import type { DeviceOutcome, DeviceRef, RunnerState, WorkbookSnapshot } from "@repo/workbook";
import { MAIN_TRACK_ID, WorkbookRunner } from "@repo/workbook";

import {
  addRealizedLaneStatus,
  addWorkbookDeviceOutcome,
  buildPendingManifest,
  setExpectedLaneAssignment,
} from "../domain/workbook-run-manifest";
import type {
  WorkbookRunDeviceOutcome,
  WorkbookRunLaneAssignment,
  WorkbookRunRealizedLane,
} from "../domain/workbook-run-manifest";
import { BroadcastUserGate, createMobileRunnerPorts } from "../services/workbook-runner-ports";
import type { MeasurementFlowStore } from "./measurement-flow-store-types";
import { useFlowAnswersStore } from "./use-flow-answers-store";

const log = createLogger("runner-measurement-flow");

export interface RunnerMeasurementFlowStore extends MeasurementFlowStore {
  runnerBacked: true;
  snapshot?: WorkbookSnapshot;
  runnerState: RunnerState | null;
  awaitingScanStart: boolean;
  awaitingAnalysisContinue: boolean;
  scanError?: unknown;
  runnerScanRound?: MultiScanRound;
  runnerSucceededCount: number;
  overviewNodeId: string | null;
  startRunnerScan: (cellId: string) => void;
  continueRunnerWithSuccesses: () => void;
  cancelRunnerScan: () => void;
  continueRunnerAnalysis: () => void;
}

let runner: WorkbookRunner | null = null;
let unsubscribeRunner: (() => void) | null = null;
let snapshotTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribeDevices: (() => void) | null = null;
let previousCellRuns: RunnerState["cellRuns"] = {};
let lastCycle = 0;
let startGeneration = 0;
let continuePartialScan = false;
let liveExecutorDeviceIds: string[] = [];
let autoFollowTargetCellId: string | null | undefined;

const scanGate = new BroadcastUserGate((pending) => {
  useRunnerMeasurementFlowStore.setState({ awaitingScanStart: pending });
});
const analysisGate = new BroadcastUserGate((pending) => {
  useRunnerMeasurementFlowStore.setState({ awaitingAnalysisContinue: pending });
});

function protocolMetadata(input: {
  cellId: string;
  source: { kind: string; protocolId?: string };
}): { protocolId?: string; protocolName?: string } {
  const state = useRunnerMeasurementFlowStore.getState();
  const node = state.flowNodes.find((candidate) => candidate.id === input.cellId);
  return {
    protocolId: input.source.kind === "protocolCell" ? input.source.protocolId : undefined,
    protocolName: node?.name,
  };
}

function mergeRound(
  current: MultiScanRound | undefined,
  round: MultiScanRound,
  targetedIds: readonly string[],
): MultiScanRound {
  const targeted = new Set(targetedIds);
  return {
    successes: [
      ...(current?.successes.filter(({ device }) => !targeted.has(device.id)) ?? []),
      ...round.successes,
    ],
    failures: [
      ...(current?.failures.filter(({ device }) => !targeted.has(device.id)) ?? []),
      ...round.failures,
    ],
  };
}

function recordPortRound(
  input: Parameters<NonNullable<Parameters<typeof createMobileRunnerPorts>[0]["onScanRound"]>>[0],
  round: MultiScanRound,
  outcomes: DeviceOutcome[],
): void {
  useRunnerMeasurementFlowStore.setState((state) => {
    const metadata = protocolMetadata(input);
    const executorEntries = new Map(
      state.runnerState?.devices.map((device) => [device.id, device] as const) ?? [],
    );
    const connectionOrder = new Map(
      state.runnerState?.devices.map((device, index) => [device.id, index] as const) ?? [],
    );
    const orderOf = (deviceId: string | undefined) =>
      deviceId === undefined
        ? Number.MAX_SAFE_INTEGER
        : (connectionOrder.get(deviceId) ?? Number.MAX_SAFE_INTEGER);
    const targeted = new Set(input.deviceIds);
    const successes: ScanResultEntry[] = round.successes.map(({ device, result }) => {
      const identity = executorEntries.get(device.id);
      const measurementDeviceId =
        resolveMeasurementDeviceId(result, identity?.deviceId ?? device.id) ??
        identity?.deviceId ??
        device.id;
      return {
        device: { id: device.id, name: device.name },
        measurementDeviceId,
        producerCellId: input.cellId,
        result: result as ScanResult,
        ...metadata,
      };
    });
    const scanResults = [
      ...(state.scanResults?.filter(({ device }) => !device || !targeted.has(device.id)) ?? []),
      ...successes,
    ].sort((left, right) => orderOf(left.device?.id) - orderOf(right.device?.id));
    const ledgerEntries: WorkbookRunDeviceOutcome[] = outcomes.map((outcome) => ({
      producer_cell_id: input.cellId,
      transport_device_id: outcome.deviceId,
      device_id:
        successes.find(({ device }) => device?.id === outcome.deviceId)?.measurementDeviceId ??
        executorEntries.get(outcome.deviceId)?.deviceId ??
        outcome.deviceId,
      outcome: outcome.error === undefined ? "ok" : "failed",
    }));
    const ledger = ledgerEntries.reduce(
      (next, entry) => addWorkbookDeviceOutcome(next.expected, next.realized, entry),
      { expected: state.workbookRunExpected, realized: state.workbookRunRealized },
    );
    const mergedRound = mergeRound(state.runnerScanRound, round, input.deviceIds);
    const runnerScanRound: MultiScanRound = {
      successes: [...mergedRound.successes].sort(
        (left, right) => orderOf(left.device.id) - orderOf(right.device.id),
      ),
      failures: [...mergedRound.failures].sort(
        (left, right) => orderOf(left.device.id) - orderOf(right.device.id),
      ),
    };
    return {
      scanResults,
      scanResult: scanResults[0]?.result,
      producerCellId: scanResults[0]?.producerCellId,
      runnerScanRound,
      runnerSucceededCount: runnerScanRound.successes.length,
      workbookRunExpected: ledger.expected,
      workbookRunRealized: ledger.realized,
    };
  });
}

const ports = createMobileRunnerPorts({
  scanGate,
  analysisGate,
  getProtocolCode: (protocolId) => {
    const node = useRunnerMeasurementFlowStore
      .getState()
      .flowNodes.find(
        (candidate) =>
          candidate.type === "measurement" && candidate.content?.protocolId === protocolId,
      );
    const code = node?.content?.protocol?.code;
    return Array.isArray(code) ? (code as Record<string, unknown>[]) : null;
  },
  getMacroMeta: (macroId) => {
    const node = useRunnerMeasurementFlowStore
      .getState()
      .flowNodes.find(
        (candidate) => candidate.type === "analysis" && candidate.content?.macroId === macroId,
      );
    const macro = node?.content?.macro;
    return macro?.code ? { code: macro.code, language: macro.language ?? "javascript" } : null;
  },
  onScanRound: recordPortRound,
  resolveDeviceIds: (input) => {
    const state = runner?.getState();
    const track = state?.tracks[input.trackId];
    const isFrozenSubset =
      input.trackId !== MAIN_TRACK_ID ||
      (track?.dispatch?.queue.some(({ targetCellId }) => targetCellId === input.cellId) ?? false);
    return isFrozenSubset ? input.deviceIds : liveExecutorDeviceIds;
  },
  shouldContinueAfterPartial: () => continuePartialScan,
  onScanError: (error) => useRunnerMeasurementFlowStore.setState({ scanError: error }),
  onScanSuccess: () => {
    void import("~/features/measurement-flow/utils/play-sound")
      .then(({ playSound }) => playSound())
      .catch(() => undefined);
  },
  onMacroOutput: (input, output) => {
    useRunnerMeasurementFlowStore.setState((state) => ({
      cellOutputs: { ...state.cellOutputs, [input.cellId]: output },
    }));
  },
});

function scheduleSnapshot(): void {
  if (snapshotTimer) return;
  snapshotTimer = setTimeout(() => {
    snapshotTimer = null;
    if (runner) useRunnerMeasurementFlowStore.setState({ snapshot: runner.snapshot() });
  }, 300);
}

function persistSnapshotNow(): void {
  if (snapshotTimer) {
    clearTimeout(snapshotTimer);
    snapshotTimer = null;
  }
  if (runner) useRunnerMeasurementFlowStore.setState({ snapshot: runner.snapshot() });
}

function disposeRunner(): void {
  startGeneration += 1;
  unsubscribeRunner?.();
  unsubscribeRunner = null;
  unsubscribeDevices?.();
  unsubscribeDevices = null;
  runner?.dispose();
  runner = null;
  scanGate.reset();
  analysisGate.reset();
  continuePartialScan = false;
  liveExecutorDeviceIds = [];
  autoFollowTargetCellId = undefined;
  previousCellRuns = {};
  if (snapshotTimer) {
    clearTimeout(snapshotTimer);
    snapshotTimer = null;
  }
}

function detectMatchedPath(state: RunnerState): MatchedPath | undefined | "unchanged" {
  let matched: MatchedPath | undefined | "unchanged" = "unchanged";
  for (const cell of state.cells) {
    if (cell.type !== "branch") continue;
    const run = state.cellRuns[cell.id];
    if (run === previousCellRuns[cell.id] || !run) continue;
    const path = cell.paths.find((candidate) => candidate.id === run.lastMatchedPathId);
    matched = path ? { label: path.label, color: path.color } : undefined;
  }
  return matched;
}

function rotateAttemptForCycle(): void {
  useRunnerMeasurementFlowStore.setState((state) => {
    const alreadyTerminalReady = state.workbookTerminalReadyAttemptId === state.workbookAttemptId;
    const manifest = alreadyTerminalReady
      ? undefined
      : buildPendingManifest({
          attemptId: state.workbookAttemptId,
          workbookVersionId: state.workbookVersionId,
          experimentId: state.experimentId,
          experimentName: state.experimentLabel,
          expected: state.workbookRunExpected,
          realized: state.workbookRunRealized,
        });
    return {
      workbookAttemptId: uuidv4(),
      workbookRunExpected: [],
      workbookRunRealized: [],
      workbookTerminalReadyAttemptId: undefined,
      pendingWorkbookRunManifests: manifest
        ? state.pendingWorkbookRunManifests.some(
            (pending) => pending.record.workbook_attempt_id === manifest.record.workbook_attempt_id,
          )
          ? state.pendingWorkbookRunManifests
          : [...state.pendingWorkbookRunManifests, manifest]
        : state.pendingWorkbookRunManifests,
      runnerScanRound: undefined,
      runnerSucceededCount: 0,
    };
  });
}

/**
 * Replays the legacy host's auto-skip decision through runner events so every
 * carried answer is also present in `answersByCycle` for downstream branches.
 */
function driveAutoFollow(state: Readonly<RunnerState>): void {
  if (autoFollowTargetCellId === undefined || !runner) return;
  const main = state.tracks[MAIN_TRACK_ID];
  if (!main) return;
  if (state.status === "done") {
    autoFollowTargetCellId = undefined;
    return;
  }
  const currentCellId = main.cursor.cellId;
  if (currentCellId === autoFollowTargetCellId) {
    autoFollowTargetCellId = undefined;
    return;
  }
  if (main.cursor.enteredVia !== "forward" || currentCellId === null) {
    autoFollowTargetCellId = undefined;
    return;
  }
  if (main.pendingInteraction?.kind === "instruction") {
    runner.send({ type: "NEXT" });
    return;
  }
  if (main.pendingInteraction?.kind === "question") {
    const value = useFlowAnswersStore.getState().getAnswer(state.cycle, currentCellId) ?? "";
    runner.send({ type: "ANSWER", trackId: MAIN_TRACK_ID, cellId: currentCellId, value });
  }
}

function mirrorRunnerState(state: Readonly<RunnerState>): void {
  const store = useRunnerMeasurementFlowStore.getState();
  const main = state.tracks[MAIN_TRACK_ID];
  if (!main) return;
  if (state.cycle !== lastCycle) {
    lastCycle = state.cycle;
    rotateAttemptForCycle();
  }
  driveAutoFollow(state);
  const matched = detectMatchedPath(state);
  previousCellRuns = state.cellRuns;
  const displayCellId =
    store.overviewNodeId ?? main.dispatch?.queue[0]?.targetCellId ?? main.cursor.cellId;
  const index = displayCellId ? store.flowNodes.findIndex((node) => node.id === displayCellId) : -1;
  const currentFlowStep = index >= 0 ? index : state.status === "done" ? store.flowNodes.length : 0;
  const cellOutputs = Object.fromEntries(
    Object.entries(state.outputs).flatMap(([cellId, entry]) =>
      entry ? [[cellId, entry.v] as const] : [],
    ),
  );
  const branchReturnStack = main.returnStack.flatMap((entry) => {
    const landing = store.flowNodes.findIndex((node) => node.id === entry.landingCellId);
    const step = entry.returnToCellId
      ? store.flowNodes.findIndex((node) => node.id === entry.returnToCellId)
      : -1;
    return landing >= 0 ? [{ landing, step }] : [];
  });
  const hasCommandInFlight = Object.values(state.inFlight).some(
    (effect) => effect?.phase === "runCommand",
  );
  useRunnerMeasurementFlowStore.setState({
    runnerState: state,
    currentFlowStep,
    iterationCount: state.cycle,
    isQuestionsSubmitPending:
      isQuestionsOnlyFlow(store.flowNodes) &&
      state.status === "done" &&
      store.overviewNodeId === null,
    isFlowFinished: !state.options.loop && state.status === "done",
    cellOutputs,
    branchVisitCounts: Object.fromEntries(
      Object.entries(main.branchVisits).filter(
        (entry): entry is [string, number] => entry[1] !== undefined,
      ),
    ),
    branchReturnStack,
    devicePlan:
      main.dispatch?.queue.flatMap(({ targetCellId, deviceIds }) =>
        deviceIds.map((deviceId) => ({ deviceId, targetCellId })),
      ) ?? undefined,
    consumedNodeIds: Object.keys(main.dispatchConsumed),
    ...(hasCommandInFlight ? {} : { runnerScanRound: undefined, runnerSucceededCount: 0 }),
    ...(matched === "unchanged" ? {} : { lastMatchedPath: matched }),
  });
  scheduleSnapshot();
}

function adoptRunner(next: WorkbookRunner): void {
  unsubscribeRunner?.();
  runner?.dispose();
  runner = next;
  lastCycle = next.getState().cycle;
  previousCellRuns = next.getState().cellRuns;
  unsubscribeRunner = next.subscribe(mirrorRunnerState);
  mirrorRunnerState(next.getState());
}

function deviceRefs(entries: Iterable<DeviceExecutorEntry>): DeviceRef[] {
  return Array.from(entries, (entry, index) => ({
    id: entry.device.id,
    label: entry.device.name || `Device ${index + 1}`,
    family: entry.identity?.family ?? "multispeq",
    deviceId: entry.identity?.deviceId,
    deviceName: entry.identity?.name ?? entry.device.name,
    firmwareVersion: entry.identity?.firmwareVersion,
  }));
}

async function connectedDeviceRefs(): Promise<DeviceRef[]> {
  const { useScannerCommandExecutorStore } = await import(
    "~/features/connection/stores/use-scanner-command-executor-store"
  );
  const initial = deviceRefs(useScannerCommandExecutorStore.getState().executors.values());
  liveExecutorDeviceIds = initial.map(({ id }) => id);
  unsubscribeDevices?.();
  unsubscribeDevices = useScannerCommandExecutorStore.subscribe((state, previous) => {
    if (state.executors === previous.executors) return;
    const next = deviceRefs(state.executors.values());
    liveExecutorDeviceIds = next.map(({ id }) => id);
    runner?.setDevices(next);
  });
  return initial;
}

async function startPreparedRunner(snapshot?: WorkbookSnapshot): Promise<void> {
  const generation = ++startGeneration;
  const state = useRunnerMeasurementFlowStore.getState();
  if (!state.experimentId || state.cells.length === 0) return;
  try {
    const devices = await connectedDeviceRefs();
    if (generation !== startGeneration || !useRunnerMeasurementFlowStore.getState().experimentId) {
      return;
    }
    const next = snapshot
      ? await WorkbookRunner.restore(snapshot, ports)
      : new WorkbookRunner({
          cells: state.cells,
          ports,
          mode: "flow",
          loop: !isQuestionsOnlyFlow(state.flowNodes),
          deviceFamily: "multispeq",
          devices,
          allowDeviceWrites: false,
        });
    if (snapshot) next.setDevices(devices);
    adoptRunner(next);
    if (!snapshot) next.start();
    persistSnapshotNow();
  } catch (error) {
    log.warn("runner start/restore failed", { err: (error as Error)?.message });
    const current = useRunnerMeasurementFlowStore.getState();
    const abandoned = snapshot ? abandonCurrentAttempt(current) : undefined;
    useRunnerMeasurementFlowStore.setState({
      ...(snapshot ? clearedRunnerState : { runnerState: null, snapshot: undefined }),
      pendingWorkbookRunManifests: abandoned
        ? [...current.pendingWorkbookRunManifests, abandoned]
        : current.pendingWorkbookRunManifests,
    });
  }
}

function abandonCurrentAttempt(state: FlowState) {
  return buildPendingManifest({
    attemptId: state.workbookAttemptId,
    workbookVersionId: state.workbookVersionId,
    experimentId: state.experimentId,
    experimentName: state.experimentLabel,
    expected: state.workbookRunExpected,
    realized: state.workbookRunRealized,
    terminalStatus: "abandoned",
  });
}

const clearedRunnerState = {
  ...initialFlowState,
  runnerBacked: true as const,
  snapshot: undefined,
  runnerState: null,
  awaitingScanStart: false,
  awaitingAnalysisContinue: false,
  scanError: undefined,
  runnerScanRound: undefined,
  runnerSucceededCount: 0,
  overviewNodeId: null,
};

function cancelThen(action: () => void): void {
  if (!runner) return;
  if (Object.keys(runner.getState().inFlight).length === 0) {
    action();
    return;
  }
  const unsubscribe = runner.subscribe((state) => {
    if (Object.keys(state.inFlight).length > 0) return;
    unsubscribe();
    action();
  });
  runner.cancel();
}

/** Patch an overview edit into the runner snapshot without replaying completed work. */
async function syncOverviewAnswerAndReturn(): Promise<void> {
  const state = useRunnerMeasurementFlowStore.getState();
  const nodeId = state.overviewNodeId;
  if (nodeId === null) return;
  if (!runner) {
    useRunnerMeasurementFlowStore.setState({ overviewNodeId: null, isFromOverview: false });
    return;
  }
  const runnerState = runner.getState();
  const hostValue = useFlowAnswersStore.getState().getAnswer(runnerState.cycle, nodeId) ?? "";
  const runnerValue = runnerState.answersByCycle[runnerState.cycle]?.[nodeId] ?? "";
  if (hostValue === runnerValue) {
    useRunnerMeasurementFlowStore.setState({ overviewNodeId: null, isFromOverview: false });
    mirrorRunnerState(runner.getState());
    return;
  }
  const snapshot = runner.snapshot();
  const answers = { ...(snapshot.state.answersByCycle[snapshot.state.cycle] ?? {}) };
  if (hostValue.trim() === "") delete answers[nodeId];
  else answers[nodeId] = hostValue;
  snapshot.state.answersByCycle[snapshot.state.cycle] = answers;
  try {
    const restored = await WorkbookRunner.restore(snapshot, ports);
    adoptRunner(restored);
    useRunnerMeasurementFlowStore.setState({ overviewNodeId: null, isFromOverview: false });
    mirrorRunnerState(restored.getState());
    persistSnapshotNow();
  } catch (error) {
    log.warn("overview answer sync failed", { err: (error as Error)?.message });
    useRunnerMeasurementFlowStore.setState({ overviewNodeId: null, isFromOverview: false });
  }
}

export const useRunnerMeasurementFlowStore = create<RunnerMeasurementFlowStore>()(
  persist(
    (set, get) => ({
      ...clearedRunnerState,
      iterationAnchor: undefined,

      setExperimentId: (experimentId, experimentLabel) => {
        const state = get();
        const previous = abandonCurrentAttempt(state);
        disposeRunner();
        set({
          experimentId,
          experimentLabel,
          workbookAttemptId: uuidv4(),
          workbookRunExpected: [],
          workbookRunRealized: [],
          workbookTerminalReadyAttemptId: undefined,
          pendingWorkbookRunManifests: previous
            ? [...state.pendingWorkbookRunManifests, previous]
            : state.pendingWorkbookRunManifests,
        });
        void startPreparedRunner();
      },
      setCurrentStep: (currentStep) => set({ currentStep }),
      setCurrentFlowStep: (step) => {
        const node = get().flowNodes[step];
        if (!runner) {
          set({ currentFlowStep: step });
          return;
        }
        autoFollowTargetCellId = node?.id ?? null;
        const state = runner.getState();
        const main = state.tracks[MAIN_TRACK_ID];
        driveAutoFollow(state);
        if (
          autoFollowTargetCellId !== undefined &&
          node &&
          !main.pendingInteraction &&
          Object.keys(state.inFlight).length === 0
        ) {
          autoFollowTargetCellId = undefined;
          runner.send({ type: "RUN_CELL", cellId: node.id });
        }
      },
      nextStep: () => {
        const state = get();
        if (state.overviewNodeId) {
          get().returnToOverview();
          return;
        }
        const node = state.flowNodes[state.currentFlowStep];
        if (node?.type === "question") {
          const value =
            useFlowAnswersStore.getState().getAnswer(state.iterationCount, node.id) ?? "";
          runner?.send({ type: "ANSWER", trackId: MAIN_TRACK_ID, cellId: node.id, value });
          return;
        }
        if (node?.type === "analysis" && analysisGate.pending) {
          analysisGate.arm();
          return;
        }
        runner?.send({ type: "NEXT" });
      },
      previousStep: () => {
        const state = get();
        if (state.isQuestionsSubmitPending) {
          const last = state.flowNodes[state.flowNodes.length - 1];
          if (last && runner) runner.send({ type: "RUN_CELL", cellId: last.id });
          set({ isQuestionsSubmitPending: false, currentFlowStep: state.flowNodes.length - 1 });
          return;
        }
        cancelThen(() => {
          const main = runner?.getState().tracks[MAIN_TRACK_ID];
          if (!runner || main?.cursor.atStart) get().resetFlow();
          else runner.send({ type: "BACK" });
        });
      },
      reset: () => get().resetFlow(),
      setFlowNodes: (flowNodes) => set({ flowNodes, currentFlowStep: 0, cells: [], edges: [] }),
      setFlowGraph: (flowNodes, edges, cells, workbookVersionId) =>
        set((state) => {
          const versionChanged =
            state.workbookVersionId !== undefined && state.workbookVersionId !== workbookVersionId;
          const previous = versionChanged ? abandonCurrentAttempt(state) : undefined;
          return {
            flowNodes,
            edges,
            cells,
            workbookVersionId,
            currentFlowStep: 0,
            branchVisitCounts: {},
            lastMatchedPath: undefined,
            branchReturnStack: [],
            ...(versionChanged
              ? {
                  workbookAttemptId: uuidv4(),
                  workbookRunExpected: [],
                  workbookRunRealized: [],
                  workbookTerminalReadyAttemptId: undefined,
                  pendingWorkbookRunManifests: previous
                    ? [...state.pendingWorkbookRunManifests, previous]
                    : state.pendingWorkbookRunManifests,
                }
              : {}),
          };
        }),
      resetFlow: () => {
        const state = get();
        const manifest = abandonCurrentAttempt(state);
        disposeRunner();
        set({
          ...clearedRunnerState,
          pendingWorkbookRunManifests: manifest
            ? [...state.pendingWorkbookRunManifests, manifest]
            : state.pendingWorkbookRunManifests,
        });
      },
      startNewIteration: () => {
        set({
          scanResult: undefined,
          scanResults: undefined,
          producerCellId: undefined,
          cellOutputs: {},
          isFromOverview: false,
        });
        runner?.send({ type: "START_CYCLE" });
      },
      retryCurrentIteration: () => {
        const state = get();
        const manifest = abandonCurrentAttempt(state);
        disposeRunner();
        set({
          workbookAttemptId: uuidv4(),
          workbookRunExpected: [],
          workbookRunRealized: [],
          workbookTerminalReadyAttemptId: undefined,
          pendingWorkbookRunManifests: manifest
            ? [...state.pendingWorkbookRunManifests, manifest]
            : state.pendingWorkbookRunManifests,
          scanResult: undefined,
          scanResults: undefined,
          producerCellId: undefined,
          cellOutputs: {},
          runnerScanRound: undefined,
          runnerSucceededCount: 0,
        });
        void startPreparedRunner();
      },
      finishFlow: () => {
        runner?.send({ type: "STOP" });
        set({ currentFlowStep: get().flowNodes.length, isFlowFinished: true });
      },
      setCellOutput: (cellId, data) =>
        set((state) => ({ cellOutputs: { ...state.cellOutputs, [cellId]: data } })),
      setIterationAnchor: (iterationAnchor) => set({ iterationAnchor }),
      dismissQuestionsSubmit: () => {
        set({
          isQuestionsSubmitPending: false,
          scanResult: undefined,
          scanResults: undefined,
          producerCellId: undefined,
          cellOutputs: {},
        });
        runner?.send({ type: "START_CYCLE" });
      },
      recordExpectedLaneAssignment: (assignment: WorkbookRunLaneAssignment) =>
        set((state) => ({
          workbookRunExpected: setExpectedLaneAssignment(state.workbookRunExpected, assignment),
        })),
      recordRealizedLaneStatus: (lane: WorkbookRunRealizedLane) =>
        set((state) => ({
          workbookRunRealized: addRealizedLaneStatus(state.workbookRunRealized, lane),
        })),
      markWorkbookRunTerminalReady: () =>
        set((state) => {
          let nextFlowStep = state.currentFlowStep + 1;
          while (
            nextFlowStep < state.flowNodes.length &&
            state.consumedNodeIds.includes(state.flowNodes[nextFlowStep].id)
          ) {
            nextFlowStep += 1;
          }
          if (
            nextFlowStep < state.flowNodes.length ||
            !state.workbookAttemptId ||
            state.workbookTerminalReadyAttemptId === state.workbookAttemptId
          ) {
            return state;
          }
          const manifest = buildPendingManifest({
            attemptId: state.workbookAttemptId,
            workbookVersionId: state.workbookVersionId,
            experimentId: state.experimentId,
            experimentName: state.experimentLabel,
            expected: state.workbookRunExpected,
            realized: state.workbookRunRealized,
          });
          if (!manifest) return state;
          return {
            workbookTerminalReadyAttemptId: state.workbookAttemptId,
            pendingWorkbookRunManifests: state.pendingWorkbookRunManifests.some(
              (pending) => pending.record.workbook_attempt_id === state.workbookAttemptId,
            )
              ? state.pendingWorkbookRunManifests
              : [...state.pendingWorkbookRunManifests, manifest],
          };
        }),
      acknowledgeWorkbookRunManifest: (attemptId) =>
        set((state) => ({
          pendingWorkbookRunManifests: state.pendingWorkbookRunManifests.filter(
            (pending) => pending.record.workbook_attempt_id !== attemptId,
          ),
        })),
      navigateToQuestionFromOverview: (questionIndex) => {
        const node = get().flowNodes[questionIndex];
        if (node)
          set({ overviewNodeId: node.id, currentFlowStep: questionIndex, isFromOverview: true });
      },
      returnToOverview: () => {
        void syncOverviewAnswerAndReturn();
      },
      startRunnerScan: (cellId) => {
        continuePartialScan = false;
        set((state) => ({
          scanError: undefined,
          ...(state.runnerScanRound ? {} : { runnerScanRound: undefined, runnerSucceededCount: 0 }),
        }));
        if (scanGate.pending) {
          scanGate.arm();
          return;
        }
        scanGate.arm();
        runner?.send({
          type: "RETRY",
          target: { kind: "postCancel", trackId: MAIN_TRACK_ID, cellId },
        });
      },
      continueRunnerWithSuccesses: () => {
        continuePartialScan = true;
        scanGate.arm();
      },
      cancelRunnerScan: () => runner?.cancel(),
      continueRunnerAnalysis: () => analysisGate.arm(),
    }),
    {
      name: "measurement-flow-storage",
      storage: createJSONStorage(() => AsyncStorage),
      version: 3,
      migrate: (persisted, version) => {
        if (version >= 3) return persisted;
        const legacy =
          persisted !== null && typeof persisted === "object"
            ? (persisted as Partial<FlowState>)
            : {};
        const abandoned = buildPendingManifest({
          attemptId: legacy.workbookAttemptId,
          workbookVersionId: legacy.workbookVersionId,
          experimentId: legacy.experimentId,
          experimentName: legacy.experimentLabel,
          expected: legacy.workbookRunExpected ?? [],
          realized: legacy.workbookRunRealized ?? [],
          terminalStatus: "abandoned",
        });
        return {
          ...clearedRunnerState,
          pendingWorkbookRunManifests: [
            ...(legacy.pendingWorkbookRunManifests ?? []),
            ...(abandoned ? [abandoned] : []),
          ],
        };
      },
      partialize: (state) => ({
        experimentId: state.experimentId,
        experimentLabel: state.experimentLabel,
        workbookVersionId: state.workbookVersionId,
        workbookAttemptId: state.workbookAttemptId,
        workbookRunExpected: state.workbookRunExpected,
        workbookRunRealized: state.workbookRunRealized,
        workbookTerminalReadyAttemptId: state.workbookTerminalReadyAttemptId,
        pendingWorkbookRunManifests: state.pendingWorkbookRunManifests,
        currentStep: state.currentStep,
        flowNodes: state.flowNodes,
        currentFlowStep: state.currentFlowStep,
        iterationCount: state.iterationCount,
        isFlowFinished: state.isFlowFinished,
        isQuestionsSubmitPending: state.isQuestionsSubmitPending,
        scanResult: state.scanResult,
        scanResults: state.scanResults,
        producerCellId: state.producerCellId,
        cellOutputs: state.cellOutputs,
        isFromOverview: state.isFromOverview,
        cells: state.cells,
        edges: state.edges,
        lastMatchedPath: state.lastMatchedPath,
        snapshot: state.snapshot,
      }),
    },
  ),
);

function restorePersistedRunner(): void {
  const state = useRunnerMeasurementFlowStore.getState();
  if (!state.experimentId && !state.snapshot) return;
  if (!state.experimentId || !state.snapshot) {
    useRunnerMeasurementFlowStore.setState({
      ...clearedRunnerState,
      pendingWorkbookRunManifests: state.pendingWorkbookRunManifests,
    });
    return;
  }
  void startPreparedRunner(state.snapshot);
}

useRunnerMeasurementFlowStore.persist.onFinishHydration(restorePersistedRunner);
if (useRunnerMeasurementFlowStore.persist.hasHydrated()) restorePersistedRunner();

export function flushRunnerMeasurementFlowSnapshot(): void {
  persistSnapshotNow();
}

export function resetRunnerMeasurementFlowForTest(): void {
  disposeRunner();
  useRunnerMeasurementFlowStore.setState({ ...clearedRunnerState, iterationAnchor: undefined });
}
