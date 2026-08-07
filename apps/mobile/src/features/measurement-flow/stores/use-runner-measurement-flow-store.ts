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
import { guardMobileWorkbookContent } from "~/features/measurement-flow/utils/workbook-capabilities";
import { flattenFlowNodes, isQuestionsOnlyFlow } from "~/shared/measurements/flow-node";
import { resolveMeasurementDeviceId } from "~/shared/measurements/measurement-device-id";
import { createLogger } from "~/shared/observability/logger";

import type {
  DeviceOutcome,
  DeviceRef,
  ParallelContainerAttempt,
  ParallelLaneAttempt,
  RunnerCell,
  RunnerState,
  WorkbookSnapshot,
} from "@repo/workbook";
import { hashCells, MAIN_TRACK_ID, parseSnapshot, WorkbookRunner } from "@repo/workbook";

import {
  addRealizedLaneStatus,
  addWorkbookDeviceOutcome,
  buildPendingManifest,
  setExpectedLaneAssignment,
} from "../domain/workbook-run-manifest";
import type {
  WorkbookRunDeviceOutcome,
  WorkbookRunExpectedLane,
  WorkbookRunContainerProvenance,
  WorkbookRunLaneAssignment,
  WorkbookRunRealizedLane,
} from "../domain/workbook-run-manifest";
import {
  AddressedUserGate,
  BroadcastUserGate,
  createMobileRunnerPorts,
} from "../services/workbook-runner-ports";
import type { AddressedGateToken } from "../services/workbook-runner-ports";
import type { MeasurementFlowStore } from "./measurement-flow-store-types";
import { useFlowAnswersStore } from "./use-flow-answers-store";

const log = createLogger("runner-measurement-flow");

export interface RunnerMeasurementFlowStore extends MeasurementFlowStore {
  runnerBacked: true;
  snapshot?: WorkbookSnapshot;
  runnerState: RunnerState | null;
  awaitingScanStart: boolean;
  awaitingAnalysisContinue: boolean;
  analysisQueue: AddressedGateToken[];
  scanError?: unknown;
  runnerScanRound?: MultiScanRound;
  runnerSucceededCount: number;
  overviewNodeId: string | null;
  startRunnerScan: (cellId: string, trackId?: string) => void;
  continueRunnerWithSuccesses: () => void;
  cancelRunnerScan: (trackId?: string) => void;
  continueRunnerAnalysis: (effectId?: string) => void;
  discardRunnerAnalysis: (trackId?: string) => void;
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
let rejectedUnsupportedPersistedFlow = false;

const SUPPORTED_FLOW_NODE_TYPES = new Set([
  "instruction",
  "question",
  "measurement",
  "analysis",
  "branch",
  "parallel",
]);
const SUPPORTED_WORKBOOK_CELL_TYPES = new Set([
  "protocol",
  "command",
  "macro",
  "question",
  "branch",
  "output",
  "markdown",
  "parallel",
]);

function validatePersistedWorkbookCells(value: unknown): RunnerCell[] {
  if (!Array.isArray(value)) throw new Error("Persisted workbook cells are not an array");
  const visit = (cells: unknown[]): void => {
    for (const candidate of cells) {
      if (
        !candidate ||
        typeof candidate !== "object" ||
        typeof (candidate as { id?: unknown }).id !== "string" ||
        typeof (candidate as { type?: unknown }).type !== "string"
      ) {
        throw new Error("Persisted workbook cell has an invalid shape");
      }
      const type = (candidate as { type: string }).type;
      if (!SUPPORTED_WORKBOOK_CELL_TYPES.has(type)) {
        throw new Error(`Unsupported mobile workbook cell type ${type}`);
      }
      if (type === "parallel") {
        const lanes = (candidate as { lanes?: unknown }).lanes;
        if (!Array.isArray(lanes)) throw new Error("Persisted parallel cell has no lanes");
        for (const lane of lanes) {
          if (
            !lane ||
            typeof lane !== "object" ||
            !Array.isArray((lane as { body?: unknown }).body)
          ) {
            throw new Error("Persisted parallel lane has no body");
          }
          visit((lane as { body: unknown[] }).body);
        }
      }
    }
  };
  visit(value);
  return value as RunnerCell[];
}

export function consumeRejectedUnsupportedPersistedFlow(): boolean {
  const rejected = rejectedUnsupportedPersistedFlow;
  rejectedUnsupportedPersistedFlow = false;
  return rejected;
}

function validatePersistedRunnerState(persisted: Partial<RunnerMeasurementFlowStore>): void {
  if (!persisted.snapshot) throw new Error("Active persisted flow has no runner snapshot");
  const snapshot = parseSnapshot(persisted.snapshot);
  if (hashCells(snapshot.state.cells) !== snapshot.cellsHash) {
    throw new Error("Persisted runner cells do not match their hash");
  }
  const snapshotCells = validatePersistedWorkbookCells(snapshot.state.cells);
  guardMobileWorkbookContent({ cells: snapshotCells });
  const cells = validatePersistedWorkbookCells(persisted.cells ?? []);
  guardMobileWorkbookContent({ cells });
  for (const node of flattenFlowNodes(persisted.flowNodes ?? [])) {
    if (!SUPPORTED_FLOW_NODE_TYPES.has(node.type)) {
      throw new Error(`Unsupported mobile flow node type ${String(node.type)}`);
    }
  }
}

const scanGate = new BroadcastUserGate((pending) => {
  useRunnerMeasurementFlowStore.setState({ awaitingScanStart: pending });
});
const analysisGate = new AddressedUserGate((analysisQueue) => {
  useRunnerMeasurementFlowStore.setState({
    analysisQueue,
    awaitingAnalysisContinue: analysisQueue.some((token) => !token.admitted),
  });
});

function normalizeScanResult(result: unknown): ScanResult {
  return result !== null && typeof result === "object" && !Array.isArray(result)
    ? (result as ScanResult)
    : { response: result };
}

function executionGeneration(): string {
  return `${startGeneration}:${useRunnerMeasurementFlowStore.getState().workbookAttemptId ?? "none"}`;
}

function protocolMetadata(input: {
  cellId: string;
  source: { kind: string; protocolId?: string };
}): { protocolId?: string; protocolName?: string } {
  const state = useRunnerMeasurementFlowStore.getState();
  const node = flattenFlowNodes(state.flowNodes).find((candidate) => candidate.id === input.cellId);
  return {
    protocolId: input.source.kind === "protocolCell" ? input.source.protocolId : undefined,
    protocolName: node?.name,
  };
}

function containerLaneForTrack(
  state: Readonly<RunnerState> | null | undefined,
  trackId: string,
): { attempt: ParallelContainerAttempt; lane: ParallelLaneAttempt } | undefined {
  if (!state || trackId === MAIN_TRACK_ID) return undefined;
  for (const attempt of Object.values(state.parallelAttempts)) {
    if (!attempt) continue;
    const lane = Object.values(attempt.lanes).find((candidate) => candidate.trackId === trackId);
    if (lane) return { attempt, lane };
  }
  return undefined;
}

function containerProvenance(
  state: Readonly<RunnerState> | null | undefined,
  trackId: string,
): WorkbookRunContainerProvenance | undefined {
  const owner = containerLaneForTrack(state, trackId);
  return owner
    ? {
        container_cell_id: owner.attempt.containerCellId,
        lane_id: owner.lane.laneId,
        container_attempt_id: owner.attempt.attemptId,
      }
    : undefined;
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
    if (!state.workbookAttemptId) return state;
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
    const provenance = containerProvenance(state.runnerState, input.trackId);
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
        result: normalizeScanResult(result),
        ...(provenance
          ? {
              containerCellId: provenance.container_cell_id,
              laneId: provenance.lane_id,
              containerAttemptId: provenance.container_attempt_id,
            }
          : {}),
        ...metadata,
        workbookAttemptId: state.workbookAttemptId,
      };
    });
    const scanResults = [
      ...(state.scanResults?.filter(({ device }) => !device || !targeted.has(device.id)) ?? []),
      ...successes,
    ].sort((left, right) => orderOf(left.device?.id) - orderOf(right.device?.id));
    const uploadKey = (entry: ScanResultEntry) =>
      [
        entry.workbookAttemptId,
        entry.containerAttemptId,
        entry.laneId,
        entry.producerCellId,
        entry.device?.id,
      ].join(":");
    const successKeys = new Set(successes.map(uploadKey));
    const uploadScanResults = [
      ...(state.uploadScanResults?.filter((entry) => !successKeys.has(uploadKey(entry))) ?? []),
      ...successes,
    ].sort((left, right) => orderOf(left.device?.id) - orderOf(right.device?.id));
    const frozenLaneAssignment = provenance
      ? state.workbookRunExpected.find(
          (entry): entry is WorkbookRunExpectedLane =>
            !("producer_cell_id" in entry) &&
            entry.container_cell_id === provenance.container_cell_id &&
            entry.lane_id === provenance.lane_id &&
            entry.container_attempt_id === provenance.container_attempt_id,
        )
      : undefined;
    const ledgerEntries: WorkbookRunDeviceOutcome[] = outcomes.map((outcome) => {
      const deviceId =
        successes.find(({ device }) => device?.id === outcome.deviceId)?.measurementDeviceId ??
        executorEntries.get(outcome.deviceId)?.deviceId ??
        frozenLaneAssignment?.device_id_by_transport?.[outcome.deviceId] ??
        outcome.deviceId;
      return {
        producer_cell_id: input.cellId,
        transport_device_id: outcome.deviceId,
        device_id: deviceId,
        outcome: outcome.error === undefined ? "ok" : "failed",
        ...provenance,
      };
    });
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
      uploadScanResults,
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
    const node = flattenFlowNodes(useRunnerMeasurementFlowStore.getState().flowNodes).find(
      (candidate) =>
        candidate.type === "measurement" && candidate.content?.protocolId === protocolId,
    );
    const code = node?.content?.protocol?.code;
    return Array.isArray(code) ? (code as Record<string, unknown>[]) : null;
  },
  getMacroMeta: (macroId) => {
    const node = flattenFlowNodes(useRunnerMeasurementFlowStore.getState().flowNodes).find(
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
  getExecutionGeneration: executionGeneration,
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
      uploadScanResults: undefined,
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
  let store = useRunnerMeasurementFlowStore.getState();
  const main = state.tracks[MAIN_TRACK_ID];
  if (!main) return;
  if (state.cycle !== lastCycle) {
    lastCycle = state.cycle;
    rotateAttemptForCycle();
    store = useRunnerMeasurementFlowStore.getState();
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
  const attempts = Object.values(state.parallelAttempts).filter(
    (attempt): attempt is NonNullable<typeof attempt> => attempt !== undefined,
  );
  const ledgerAttemptIds = new Set(
    [...store.workbookRunExpected, ...store.workbookRunRealized].flatMap((entry) =>
      entry.container_attempt_id ? [entry.container_attempt_id] : [],
    ),
  );
  const latestAttempt = attempts.find(
    (attempt) => attempt.attemptId === `${attempt.containerCellId}:${state.containerAttemptSeq}`,
  );
  const relevantAttemptIds = new Set([
    ...ledgerAttemptIds,
    ...(state.activeContainerAttemptId ? [state.activeContainerAttemptId] : []),
    ...(latestAttempt && state.cellRuns[latestAttempt.containerCellId]
      ? [latestAttempt.attemptId]
      : []),
  ]);
  for (const attempt of attempts) {
    if (!relevantAttemptIds.has(attempt.attemptId)) continue;
    for (const lane of Object.values(attempt.lanes)) {
      const provenance = {
        container_cell_id: attempt.containerCellId,
        lane_id: lane.laneId,
        container_attempt_id: attempt.attemptId,
      };
      const hasAssignment = useRunnerMeasurementFlowStore
        .getState()
        .workbookRunExpected.some(
          (entry) =>
            !("producer_cell_id" in entry) &&
            entry.container_cell_id === provenance.container_cell_id &&
            entry.lane_id === provenance.lane_id &&
            entry.container_attempt_id === provenance.container_attempt_id,
        );
      if (!hasAssignment) {
        store.recordExpectedLaneAssignment({
          ...provenance,
          devices: lane.deviceIds.map((deviceId) => {
            const device = state.devices.find((candidate) => candidate.id === deviceId);
            return {
              transport_device_id: deviceId,
              handshake_device_id: device?.deviceId,
            };
          }),
        });
      }
      if (["done", "partial", "failed", "skipped"].includes(lane.status)) {
        store.recordRealizedLaneStatus({
          ...provenance,
          status: lane.status as "done" | "partial" | "failed" | "skipped",
          ...(lane.terminalReason === "Abandoned by researcher" ? { abandoned: true } : {}),
        });
      }
    }
  }
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
          pauseAfterInlineCommand: true,
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
    if (snapshot) useFlowAnswersStore.getState().clearHistory();
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
  analysisQueue: [],
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
        const pendingAnalysis = analysisGate.pending[0];
        if (pendingAnalysis) {
          analysisGate.release(pendingAnalysis.effectId);
          return;
        }
        const node = state.flowNodes[state.currentFlowStep];
        if (node?.type === "question") {
          const value =
            useFlowAnswersStore.getState().getAnswer(state.iterationCount, node.id) ?? "";
          runner?.send({ type: "ANSWER", trackId: MAIN_TRACK_ID, cellId: node.id, value });
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
          uploadScanResults: undefined,
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
          uploadScanResults: undefined,
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
          uploadScanResults: undefined,
          producerCellId: undefined,
          cellOutputs: {},
        });
        runner?.send({ type: "START_CYCLE" });
      },
      recordExpectedLaneAssignment: (assignment: WorkbookRunLaneAssignment) =>
        set((state) => {
          const existing = state.workbookRunExpected.find(
            (entry): entry is WorkbookRunExpectedLane =>
              !("producer_cell_id" in entry) &&
              entry.container_cell_id === assignment.container_cell_id &&
              entry.lane_id === assignment.lane_id &&
              entry.container_attempt_id === assignment.container_attempt_id,
          );
          const reconciledAssignment = {
            ...assignment,
            devices: assignment.devices.map((device) => ({
              ...device,
              handshake_device_id:
                device.handshake_device_id ??
                existing?.device_id_by_transport?.[device.transport_device_id],
            })),
          };
          return {
            workbookRunExpected: setExpectedLaneAssignment(
              state.workbookRunExpected,
              reconciledAssignment,
            ),
          };
        }),
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
            !!state.runnerState?.activeContainerAttemptId ||
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
      navigateToQuestionFromOverview: (questionId) => {
        const topLevelIndex = get().flowNodes.findIndex(
          (node) =>
            node.id === questionId ||
            (node.type === "parallel" &&
              flattenFlowNodes([node]).some((candidate) => candidate.id === questionId)),
        );
        if (topLevelIndex >= 0) {
          set({
            overviewNodeId: questionId,
            currentFlowStep: topLevelIndex,
            isFromOverview: true,
            isQuestionsSubmitPending: false,
          });
        }
      },
      returnToOverview: () => {
        void syncOverviewAnswerAndReturn();
      },
      continueRunnerTrackInteraction: (trackId, cellId, value) => {
        const interaction = runner?.getState().tracks[trackId]?.pendingInteraction;
        if (!runner || interaction?.cellId !== cellId) return;
        if (interaction.kind === "question") {
          runner.send({ type: "ANSWER", trackId, cellId, value: value ?? "" });
        } else if (interaction.kind === "instruction") {
          runner.send({ type: "CONTINUE_TRACK", trackId, cellId });
        }
      },
      abandonRunnerLane: (trackId) => runner?.send({ type: "ABANDON_LANE", trackId }),
      restartRunnerContainer: (containerCellId, attemptId) =>
        runner?.send({
          type: "RETRY",
          target: { kind: "containerAttempt", containerCellId, attemptId },
        }),
      startRunnerScan: (cellId, trackId) => {
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
          target: { kind: "postCancel", trackId: trackId ?? MAIN_TRACK_ID, cellId },
        });
      },
      continueRunnerWithSuccesses: () => {
        continuePartialScan = true;
        scanGate.arm();
      },
      cancelRunnerScan: (trackId) => {
        if (trackId && trackId !== MAIN_TRACK_ID) {
          runner?.send({ type: "ABANDON_LANE", trackId });
          return;
        }
        runner?.cancel();
      },
      continueRunnerAnalysis: (effectId) => {
        const target = effectId ?? analysisGate.pending[0]?.effectId;
        if (target) analysisGate.release(target);
      },
      discardRunnerAnalysis: (trackId) => {
        if (trackId && trackId !== MAIN_TRACK_ID) {
          runner?.send({ type: "ABANDON_LANE", trackId });
          return;
        }
        get().previousStep();
      },
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
      merge: (persisted, current) => {
        const candidate =
          persisted !== null && typeof persisted === "object"
            ? (persisted as Partial<RunnerMeasurementFlowStore>)
            : {};
        if (candidate.experimentId || candidate.snapshot) {
          try {
            validatePersistedRunnerState(candidate);
          } catch (error) {
            rejectedUnsupportedPersistedFlow = true;
            log.warn("persisted runner rejected before publication", {
              err: (error as Error)?.message,
            });
            return {
              ...current,
              pendingWorkbookRunManifests: candidate.pendingWorkbookRunManifests ?? [],
            };
          }
        }
        return { ...current, ...candidate };
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
        uploadScanResults: state.uploadScanResults,
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
