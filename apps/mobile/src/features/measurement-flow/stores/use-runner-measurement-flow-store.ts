import AsyncStorage from "@react-native-async-storage/async-storage";
import { v4 as uuidv4 } from "uuid";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { MultiScanRound } from "~/features/connection/services/scan-manager/execute-scan-assignments";
import type {
  FlowState,
  MatchedPath,
  ScanResult,
  ScanResultEntry,
} from "~/features/measurement-flow/domain/flow-transitions";
import { initialFlowState } from "~/features/measurement-flow/domain/flow-transitions";
import { isQuestionsOnlyFlow } from "~/shared/measurements/flow-node";
import { resolveMeasurementDeviceId } from "~/shared/measurements/measurement-device-id";
import { createLogger } from "~/shared/observability/logger";

import type { DeviceOutcome, DeviceRef, RunnerState, WorkbookSnapshot } from "@repo/workbook";
import { MAIN_TRACK_ID, WorkbookRunner } from "@repo/workbook";

import {
  addExpectedDevice,
  addRealizedLaneStatus,
  addRealizedOutcome,
  addWorkbookDeviceOutcome,
  buildPendingManifest,
  setExpectedLaneAssignment,
} from "../domain/workbook-run-manifest";
import type {
  WorkbookRunDeviceOutcome,
  WorkbookRunLaneAssignment,
  WorkbookRunRealizedLane,
  WorkbookRunRealizedProducer,
} from "../domain/workbook-run-manifest";
import { BroadcastUserGate, createMobileRunnerPorts } from "../services/workbook-runner-ports";
import { useFlowAnswersStore } from "./use-flow-answers-store";
import type { MeasurementFlowStore } from "./use-measurement-flow-store";

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
let previousCellRuns: RunnerState["cellRuns"] = {};
let lastCycle = 0;
let startGeneration = 0;
let continuePartialScan = false;

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
    ];
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
    const runnerScanRound = mergeRound(state.runnerScanRound, round, input.deviceIds);
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
  runner?.dispose();
  runner = null;
  scanGate.reset();
  analysisGate.reset();
  continuePartialScan = false;
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
    const manifest = buildPendingManifest({
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
        ? [...state.pendingWorkbookRunManifests, manifest]
        : state.pendingWorkbookRunManifests,
      runnerScanRound: undefined,
      runnerSucceededCount: 0,
      scanResult: undefined,
      scanResults: undefined,
      producerCellId: undefined,
    };
  });
}

function mirrorRunnerState(state: Readonly<RunnerState>): void {
  const store = useRunnerMeasurementFlowStore.getState();
  const main = state.tracks[MAIN_TRACK_ID];
  if (!main) return;
  if (state.cycle !== lastCycle) {
    lastCycle = state.cycle;
    rotateAttemptForCycle();
  }
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

async function connectedDeviceRefs(): Promise<DeviceRef[]> {
  const { useScannerCommandExecutorStore } = await import(
    "~/features/connection/stores/use-scanner-command-executor-store"
  );
  return Array.from(
    useScannerCommandExecutorStore.getState().executors.values(),
    (entry, index) => ({
      id: entry.device.id,
      label: entry.device.name || `Device ${index + 1}`,
      family: entry.identity?.family ?? "multispeq",
      deviceId: entry.identity?.deviceId,
      deviceName: entry.identity?.name ?? entry.device.name,
      firmwareVersion: entry.identity?.firmwareVersion,
    }),
  );
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
    useRunnerMeasurementFlowStore.setState({
      runnerState: null,
      snapshot: undefined,
      experimentId: snapshot ? undefined : state.experimentId,
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

export const useRunnerMeasurementFlowStore = create<RunnerMeasurementFlowStore>()(
  persist(
    (set, get) => ({
      ...clearedRunnerState,
      iterationAnchor: undefined,

      setExperimentId: (experimentId, experimentLabel) => {
        const state = get();
        const previous = abandonCurrentAttempt(state);
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
        const state = get();
        const node = get().flowNodes[step];
        const main = runner?.getState().tracks[MAIN_TRACK_ID];
        const awaitedQuestion = main?.pendingInteraction?.kind === "question";
        if (runner && awaitedQuestion && main.cursor.cellId) {
          const value =
            useFlowAnswersStore.getState().getAnswer(state.iterationCount, main.cursor.cellId) ??
            "";
          runner.send({
            type: "ANSWER",
            trackId: MAIN_TRACK_ID,
            cellId: main.cursor.cellId,
            value,
          });
        } else if (node && runner) runner.send({ type: "RUN_CELL", cellId: node.id });
        else set({ currentFlowStep: step });
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
        cancelThen(() => {
          const main = runner?.getState().tracks[MAIN_TRACK_ID];
          if (!runner || main?.cursor.atStart) get().resetFlow();
          else runner.send({ type: "BACK" });
        });
      },
      reset: () => get().resetFlow(),
      setFlowNodes: (flowNodes) => set({ flowNodes, currentFlowStep: 0, cells: [], edges: [] }),
      setFlowGraph: (flowNodes, edges, cells, workbookVersionId) =>
        set({
          flowNodes,
          edges,
          cells,
          workbookVersionId,
          currentFlowStep: 0,
          branchVisitCounts: {},
          lastMatchedPath: undefined,
          branchReturnStack: [],
        }),
      setLastMatchedPath: (lastMatchedPath) => set({ lastMatchedPath }),
      incrementBranchVisit: () => undefined,
      recordBranchJump: () => undefined,
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
      startNewIteration: () => runner?.send({ type: "START_CYCLE" }),
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
      setScanResult: (scanResult, producerCellId) =>
        set({
          scanResult,
          scanResults: scanResult === undefined ? undefined : [{ result: scanResult }],
          producerCellId,
        }),
      setScanResults: (scanResults, producerCellId) =>
        set({ scanResults, scanResult: scanResults[0]?.result, producerCellId }),
      setCellOutput: (cellId, data) =>
        set((state) => ({ cellOutputs: { ...state.cellOutputs, [cellId]: data } })),
      setDevicePlan: () => undefined,
      completeDevicePlan: () => undefined,
      setIterationAnchor: (iterationAnchor) => set({ iterationAnchor }),
      dismissQuestionsSubmit: () => runner?.send({ type: "START_CYCLE" }),
      recordExpectedDevices: (entries) =>
        set((state) => ({
          workbookRunExpected: entries.reduce(
            (expected, entry) => addExpectedDevice(expected, entry.producerCellId, entry.deviceId),
            state.workbookRunExpected,
          ),
        })),
      recordExpectedLaneAssignment: (assignment: WorkbookRunLaneAssignment) =>
        set((state) => ({
          workbookRunExpected: setExpectedLaneAssignment(state.workbookRunExpected, assignment),
        })),
      recordRealizedOutcomes: (entries: WorkbookRunRealizedProducer[]) =>
        set((state) => ({
          workbookRunRealized: entries.reduce(
            (realized, entry) => addRealizedOutcome(realized, entry),
            state.workbookRunRealized,
          ),
        })),
      recordRealizedLaneStatus: (lane: WorkbookRunRealizedLane) =>
        set((state) => ({
          workbookRunRealized: addRealizedLaneStatus(state.workbookRunRealized, lane),
        })),
      recordWorkbookDeviceOutcomes: (entries: WorkbookRunDeviceOutcome[]) =>
        set((state) => {
          const ledger = entries.reduce(
            (next, entry) => addWorkbookDeviceOutcome(next.expected, next.realized, entry),
            { expected: state.workbookRunExpected, realized: state.workbookRunRealized },
          );
          return {
            workbookRunExpected: ledger.expected,
            workbookRunRealized: ledger.realized,
          };
        }),
      markWorkbookRunTerminalReady: () =>
        set((state) => {
          if (!state.workbookAttemptId) return state;
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
        const state = get();
        const questionsOnly = isQuestionsOnlyFlow(state.flowNodes);
        set({
          overviewNodeId: null,
          isFromOverview: false,
          isQuestionsSubmitPending: questionsOnly,
          currentFlowStep: questionsOnly
            ? state.flowNodes.length
            : Math.max(
                0,
                state.flowNodes.findIndex((node) => node.type === "measurement"),
              ),
        });
        if (runner) mirrorRunnerState(runner.getState());
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
      name: "measurement-flow-runner-storage",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persisted) => persisted as RunnerMeasurementFlowStore,
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

useRunnerMeasurementFlowStore.persist.onFinishHydration(() => {
  const { experimentId, snapshot } = useRunnerMeasurementFlowStore.getState();
  if (experimentId && snapshot) void startPreparedRunner(snapshot);
});

export function flushRunnerMeasurementFlowSnapshot(): void {
  persistSnapshotNow();
}

export function resetRunnerMeasurementFlowForTest(): void {
  disposeRunner();
  useRunnerMeasurementFlowStore.setState({ ...clearedRunnerState, iterationAnchor: undefined });
}
