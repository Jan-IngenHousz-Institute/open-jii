import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  autoAdvanceDecision,
  carryForwardAnswers,
  firstManualQuestionNodeId,
  seedNextIterationAnswer,
} from "~/features/measurement-flow/domain/iteration";
import {
  createMobileRunnerPorts,
  UserGate,
} from "~/features/measurement-flow/services/workbook-runner-ports";
import { useFlowAnswersStore } from "~/features/measurement-flow/stores/use-flow-answers-store";
import { hydrateFlowNodes } from "~/features/measurement-flow/utils/hydrate-flow-nodes";
import type { FlowNode } from "~/shared/measurements/flow-node";
import { isQuestionsOnlyFlow } from "~/shared/measurements/flow-node";
import { createLogger } from "~/shared/observability/logger";

import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";
import type { EntitySnapshots } from "@repo/api/schemas/workbook-version.schema";
import { cellsToFlowGraph } from "@repo/api/utils/cells-to-flow";
import type { RunnerState, WorkbookSnapshot } from "@repo/workbook";
import { WorkbookRunner } from "@repo/workbook";

const log = createLogger("workbook-flow");

// Raw MultispeQ output: device-defined JSON the runner stores verbatim in its
// outputs map and the upload path reads back. Structural on purpose.
export type ScanResult = Record<string, unknown>;

/** The branch path the flow last routed through, surfaced inline in the hero. */
export interface MatchedPath {
  label: string;
  color: string;
}

interface PreparedFlow {
  cells: WorkbookCell[];
  entitySnapshots?: EntitySnapshots;
  flowNodes: FlowNode[];
}

interface WorkbookFlowStore {
  // Persisted slice (wire format v1, pinned by flow-store-persistence.test.ts).
  experimentId?: string;
  experimentLabel?: string;
  entitySnapshots?: EntitySnapshots;
  /** WorkbookRunner snapshot (its own schemaVersion 1 wire format). */
  snapshot?: WorkbookSnapshot;

  // Volatile mirrors/derivations, rebuilt from the runner on every change.
  runnerState: RunnerState | null;
  flowNodes: FlowNode[];
  questionsOnly: boolean;
  measurementCellId: string | null;
  currentNodeIndex: number;
  currentNode: FlowNode | undefined;
  iterationCount: number;
  isQuestionsSubmitPending: boolean;
  scanResult?: ScanResult;
  lastMatchedPath?: MatchedPath;
  awaitingScanStart: boolean;
  /** Raw executor failure for the active producer, cleared on re-run. */
  scanError?: unknown;
  overviewNodeId: string | null;
  iterationAnchor?: { iteration: number; nodeId?: string };
  /** Graph pre-loaded while the picker is open, promoted by startFlow. */
  prepared: PreparedFlow | null;

  prepareFlow: (cells: WorkbookCell[], entitySnapshots?: EntitySnapshots) => void;
  clearPreparedFlow: () => void;
  startFlow: (experimentId: string, experimentLabel?: string) => void;

  next: () => void;
  back: () => void;
  commitAnswer: (node: FlowNode, value: string) => void;
  startScan: (cellId: string) => void;
  cancelScan: () => void;
  retryFromAnalysis: () => void;
  continueFromAnalysis: (macroCellId: string) => void;
  dismissQuestionsSubmit: () => void;
  openQuestionFromOverview: (nodeIndex: number) => void;
  returnToOverview: () => void;
  abandonFlow: () => void;
}

// ---------------------------------------------------------------------------
// Controller: the WorkbookRunner instance and its follow/gate bookkeeping live
// at module level; the zustand store below only mirrors state for the UI.

let runner: WorkbookRunner | null = null;
let unsubscribeRunner: (() => void) | null = null;
let lastCycle = 0;
// Mirrors mobile's advanceWithAnswer/iteration-sync skipping: after an answer
// commit or a cycle wrap, keep walking over instructions (iteration > 0) and
// auto-increment/remembered questions until a step needs manual input.
let autoFollow = false;
let prevCellRuns: RunnerState["cellRuns"] = {};
let snapshotTimer: ReturnType<typeof setTimeout> | null = null;

const scanGate = new UserGate((pending) => {
  useWorkbookFlowStore.setState({ awaitingScanStart: pending });
});
const analysisGate = new UserGate();

const ports = createMobileRunnerPorts({
  scanGate,
  analysisGate,
  getProtocolCode: (protocolId) => {
    const code = useWorkbookFlowStore.getState().entitySnapshots?.protocols[protocolId]?.code;
    return Array.isArray(code) ? (code as Record<string, unknown>[]) : null;
  },
  getMacroMeta: (macroId) => {
    const state = useWorkbookFlowStore.getState();
    const code = state.entitySnapshots?.macros[macroId]?.code;
    if (!code) return null;
    const cell = state.runnerState?.cells.find(
      (c): c is Extract<WorkbookCell, { type: "macro" }> =>
        c.type === "macro" && (c as { payload: { macroId?: string } }).payload.macroId === macroId,
    );
    return { code, language: cell?.payload.language ?? "javascript" };
  },
  onScanError: (error) => {
    useWorkbookFlowStore.setState({ scanError: error });
  },
  onScanSuccess: () => {
    // Lazy import: play-sound instantiates an expo-audio player at load time.
    void import("~/features/measurement-flow/utils/play-sound")
      .then((m) => m.playSound())
      .catch(() => undefined);
  },
});

function deriveFlowNodes(cells: WorkbookCell[], snapshots?: EntitySnapshots): FlowNode[] {
  const { nodes } = cellsToFlowGraph(cells);
  return hydrateFlowNodes(nodes as FlowNode[], cells, snapshots);
}

function firstMeasurementCellId(flowNodes: FlowNode[]): string | null {
  return flowNodes.find((n) => n.type === "measurement")?.id ?? null;
}

function schedulePersistSnapshot(): void {
  if (snapshotTimer) return;
  snapshotTimer = setTimeout(() => {
    snapshotTimer = null;
    if (runner) useWorkbookFlowStore.setState({ snapshot: runner.snapshot() });
  }, 300);
}

function persistSnapshotNow(): void {
  if (snapshotTimer) {
    clearTimeout(snapshotTimer);
    snapshotTimer = null;
  }
  if (runner) useWorkbookFlowStore.setState({ snapshot: runner.snapshot() });
}

/** Eagerly seed remembered/auto-incremented answers for the new iteration. */
function runCarryForward(cycle: number, flowNodes: FlowNode[]): void {
  const answers = useFlowAnswersStore.getState();
  const seeds = carryForwardAnswers({ flowNodes, iterationCount: cycle, answers });
  for (const seed of seeds) {
    useFlowAnswersStore.getState().setAnswer(seed.cycle, seed.name, seed.value);
  }
  useWorkbookFlowStore.setState({
    iterationAnchor: {
      iteration: cycle,
      nodeId: firstManualQuestionNodeId(flowNodes, useFlowAnswersStore.getState()),
    },
  });
}

function driveAutoFollow(state: RunnerState): void {
  if (!autoFollow || !runner) return;
  if (state.status !== "awaitingInput") {
    // Producers park behind their gates; stop following there.
    if (state.status !== "running") autoFollow = false;
    return;
  }
  if (state.position.enteredVia !== "forward" || state.position.cellId === null) {
    autoFollow = false;
    return;
  }
  const cell = state.cells.find((c) => c.id === state.position.cellId);
  if (!cell) {
    autoFollow = false;
    return;
  }
  if (cell.type === "markdown") {
    if (state.cycle > 0) runner.send({ type: "NEXT" });
    else autoFollow = false;
    return;
  }
  if (cell.type === "question") {
    const decision = autoAdvanceDecision({
      questionId: cell.id,
      required: (cell.question as { required?: boolean }).required ?? false,
      iterationCount: state.cycle,
      answers: useFlowAnswersStore.getState(),
    });
    if (decision.kind === "commit")
      runner.send({ type: "ANSWER", cellId: cell.id, value: decision.value });
    else if (decision.kind === "skip") runner.send({ type: "NEXT" });
    else autoFollow = false;
    return;
  }
  autoFollow = false;
}

/** The branch that evaluated in this update, if any (identity diff on runs). */
function detectMatchedPath(state: RunnerState): MatchedPath | undefined | "unchanged" {
  let result: MatchedPath | undefined | "unchanged" = "unchanged";
  for (const cell of state.cells) {
    if (cell.type !== "branch") continue;
    const run = state.cellRuns[cell.id];
    if (run === prevCellRuns[cell.id] || run === undefined) continue;
    const branch = cell;
    const matched = branch.paths.find((p) => p.id === run.lastMatchedPathId);
    result = matched ? { label: matched.label, color: matched.color } : undefined;
  }
  return result;
}

function mirrorRunnerState(state: RunnerState): void {
  const store = useWorkbookFlowStore.getState();
  const { flowNodes, questionsOnly, measurementCellId, overviewNodeId } = store;

  const cycleChanged = state.cycle !== lastCycle;
  if (cycleChanged) {
    lastCycle = state.cycle;
    autoFollow = true;
    runCarryForward(state.cycle, flowNodes);
  }
  // Events the driver sends re-enter the runner's queue and produce their own
  // notify, so this mirror only needs to reflect the state it was handed.
  driveAutoFollow(state);

  const matched = detectMatchedPath(state);
  prevCellRuns = state.cellRuns;

  const positionId = overviewNodeId ?? state.position.cellId;
  const index = positionId === null ? -1 : flowNodes.findIndex((n) => n.id === positionId);
  const currentNodeIndex = index >= 0 ? index : state.status === "done" ? flowNodes.length : 0;

  useWorkbookFlowStore.setState({
    runnerState: state,
    currentNodeIndex,
    currentNode: flowNodes[currentNodeIndex],
    iterationCount: state.cycle,
    isQuestionsSubmitPending: questionsOnly && state.status === "done" && overviewNodeId === null,
    scanResult:
      measurementCellId === null
        ? undefined
        : (state.outputs[measurementCellId]?.v as ScanResult | undefined),
    ...(cycleChanged ? { lastMatchedPath: undefined } : {}),
    ...(matched === "unchanged" ? {} : { lastMatchedPath: matched }),
  });
  schedulePersistSnapshot();
}

function adoptRunner(next: WorkbookRunner): void {
  unsubscribeRunner?.();
  runner?.dispose();
  scanGate.reset();
  analysisGate.reset();
  runner = next;
  lastCycle = next.getState().cycle;
  autoFollow = false;
  prevCellRuns = next.getState().cellRuns;
  unsubscribeRunner = next.subscribe(mirrorRunnerState);
}

function disposeRunner(): void {
  unsubscribeRunner?.();
  unsubscribeRunner = null;
  runner?.dispose();
  runner = null;
  scanGate.reset();
  analysisGate.reset();
  autoFollow = false;
  prevCellRuns = {};
  if (snapshotTimer) {
    clearTimeout(snapshotTimer);
    snapshotTimer = null;
  }
}

/** Run `fn` once no effect is in flight (cancels a pending one first). */
function cancelThen(fn: () => void): void {
  if (!runner) return;
  const status = runner.getState().status;
  if (status !== "running" && status !== "cancelling") {
    fn();
    return;
  }
  const unsub = runner.subscribe((s) => {
    if (s.status === "running" || s.status === "cancelling") return;
    unsub();
    fn();
  });
  runner.cancel();
}

const clearedFlowSlice = {
  experimentId: undefined,
  experimentLabel: undefined,
  entitySnapshots: undefined,
  snapshot: undefined,
  runnerState: null,
  flowNodes: [] as FlowNode[],
  questionsOnly: false,
  measurementCellId: null,
  currentNodeIndex: 0,
  currentNode: undefined,
  iterationCount: 0,
  isQuestionsSubmitPending: false,
  scanResult: undefined,
  lastMatchedPath: undefined,
  awaitingScanStart: false,
  scanError: undefined,
  overviewNodeId: null,
  iterationAnchor: undefined,
};

/** Rebuild the runner from a snapshot patched with the host's answer edits. */
async function syncDetourAnswerAndReturn(): Promise<void> {
  const store = useWorkbookFlowStore.getState();
  const nodeId = store.overviewNodeId;
  if (nodeId === null) return;
  if (!runner) {
    useWorkbookFlowStore.setState({ overviewNodeId: null });
    return;
  }
  const state = runner.getState();
  const hostValue = useFlowAnswersStore.getState().getAnswer(state.cycle, nodeId) ?? "";
  const runnerValue = state.answersByCycle[state.cycle]?.[nodeId] ?? "";
  if (hostValue === runnerValue) {
    useWorkbookFlowStore.setState({ overviewNodeId: null });
    if (runner) mirrorRunnerState(runner.getState());
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
    useWorkbookFlowStore.setState({ overviewNodeId: null });
    mirrorRunnerState(restored.getState());
    persistSnapshotNow();
  } catch (error) {
    log.error("detour answer sync failed", { err: (error as Error)?.message });
    useWorkbookFlowStore.setState({ overviewNodeId: null });
  }
}

async function restorePersistedFlow(): Promise<void> {
  const { experimentId, snapshot, entitySnapshots } = useWorkbookFlowStore.getState();
  if (!experimentId || !snapshot) {
    // Half-written slice (kill between store writes): drop it entirely.
    if (experimentId || snapshot) useWorkbookFlowStore.setState(clearedFlowSlice);
    return;
  }
  try {
    const restored = await WorkbookRunner.restore(snapshot, ports);
    const cells = restored.getState().cells as WorkbookCell[];
    const flowNodes = deriveFlowNodes(cells, entitySnapshots);
    useWorkbookFlowStore.setState({
      flowNodes,
      questionsOnly: isQuestionsOnlyFlow(flowNodes),
      measurementCellId: firstMeasurementCellId(flowNodes),
    });
    adoptRunner(restored);
    mirrorRunnerState(restored.getState());
  } catch (error) {
    // Stale or incompatible snapshot: drop the paused flow rather than crash.
    log.warn("dropping unrestorable flow snapshot", { err: (error as Error)?.message });
    useWorkbookFlowStore.setState(clearedFlowSlice);
  }
}

// ---------------------------------------------------------------------------

export const useWorkbookFlowStore = create<WorkbookFlowStore>()(
  persist(
    (set, get) => ({
      experimentId: undefined,
      experimentLabel: undefined,
      entitySnapshots: undefined,
      snapshot: undefined,

      runnerState: null,
      flowNodes: [],
      questionsOnly: false,
      measurementCellId: null,
      currentNodeIndex: 0,
      currentNode: undefined,
      iterationCount: 0,
      isQuestionsSubmitPending: false,
      scanResult: undefined,
      lastMatchedPath: undefined,
      awaitingScanStart: false,
      scanError: undefined,
      overviewNodeId: null,
      iterationAnchor: undefined,
      prepared: null,

      prepareFlow: (cells, entitySnapshots) => {
        set({
          prepared: { cells, entitySnapshots, flowNodes: deriveFlowNodes(cells, entitySnapshots) },
        });
      },

      clearPreparedFlow: () => set({ prepared: null }),

      startFlow: (experimentId, experimentLabel) => {
        const prepared = get().prepared;
        if (!prepared) return;
        const questionsOnly = isQuestionsOnlyFlow(prepared.flowNodes);
        set({
          ...clearedFlowSlice,
          experimentId,
          experimentLabel,
          entitySnapshots: prepared.entitySnapshots,
          flowNodes: prepared.flowNodes,
          questionsOnly,
          measurementCellId: firstMeasurementCellId(prepared.flowNodes),
        });
        const next = new WorkbookRunner({
          cells: prepared.cells,
          ports,
          mode: "flow",
          // Questions-only flows end at the review screen instead of wrapping;
          // "done" maps to isQuestionsSubmitPending and START_CYCLE continues.
          loop: !questionsOnly,
          deviceFamily: "multispeq",
          allowDeviceWrites: false,
        });
        adoptRunner(next);
        next.start();
        persistSnapshotNow();
      },

      next: () => {
        autoFollow = false;
        runner?.send({ type: "NEXT" });
      },

      back: () => {
        autoFollow = false;
        cancelThen(() => {
          if (!runner) return;
          if (runner.getState().position.atStart) get().abandonFlow();
          else runner.send({ type: "BACK" });
        });
      },

      commitAnswer: (node, value) => {
        const answers = useFlowAnswersStore.getState();
        const seed = seedNextIterationAnswer({
          node,
          answerValue: value,
          iterationCount: get().iterationCount,
          answers,
        });
        if (seed) answers.setAnswer(seed.cycle, seed.name, seed.value);
        if (get().overviewNodeId !== null) {
          get().returnToOverview();
          return;
        }
        autoFollow = true;
        runner?.send({ type: "ANSWER", cellId: node.id, value });
      },

      startScan: (cellId) => {
        // Already executing (gate released): never queue a second run.
        if (get().runnerState?.status === "running" && !scanGate.pending) return;
        autoFollow = false;
        set({ scanError: undefined });
        if (scanGate.pending) {
          scanGate.arm();
          return;
        }
        // Parked producer (entered via back, cancelled, errored, interrupted):
        // force a re-run; the pre-armed gate lets it fire without re-parking.
        scanGate.arm();
        runner?.send({ type: "RUN_CELL", cellId });
      },

      cancelScan: () => {
        runner?.cancel();
      },

      retryFromAnalysis: () => {
        autoFollow = false;
        cancelThen(() => runner?.send({ type: "BACK" }));
      },

      continueFromAnalysis: (macroCellId) => {
        autoFollow = false;
        if (analysisGate.pending) {
          analysisGate.arm();
          return;
        }
        if (!runner) return;
        const run = runner.getState().cellRuns[macroCellId];
        if (run?.status === "completed") {
          runner.send({ type: "NEXT" });
          return;
        }
        // Interrupted/cancelled macro (e.g. restored mid-analysis): re-run it
        // with the gate pre-armed so completion continues immediately.
        analysisGate.arm();
        runner.send({ type: "RUN_CELL", cellId: macroCellId });
      },

      dismissQuestionsSubmit: () => {
        runner?.send({ type: "START_CYCLE" });
      },

      openQuestionFromOverview: (nodeIndex) => {
        const node = get().flowNodes[nodeIndex];
        if (!node) return;
        autoFollow = false;
        set({ overviewNodeId: node.id, isQuestionsSubmitPending: false });
        if (runner) mirrorRunnerState(runner.getState());
      },

      returnToOverview: () => {
        void syncDetourAnswerAndReturn();
      },

      abandonFlow: () => {
        disposeRunner();
        // Mobile parity: backing out clears the flow, not the answer history
        // (the rehydration guard reconciles the orphan on next boot).
        set(clearedFlowSlice);
      },
    }),
    {
      name: "workbook-flow-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // v1 wire format, pinned by flow-store-persistence.test.ts. The
      // runner snapshot carries its own schemaVersion + migration seam.
      version: 1,
      migrate: (persisted) => persisted as WorkbookFlowStore,
      partialize: (state) => ({
        experimentId: state.experimentId,
        experimentLabel: state.experimentLabel,
        entitySnapshots: state.entitySnapshots,
        snapshot: state.snapshot,
      }),
    },
  ),
);

// Rebuild the runner from the persisted snapshot once hydration lands (and
// handle the already-hydrated case for tests / hot reload).
useWorkbookFlowStore.persist.onFinishHydration(() => {
  void restorePersistedFlow();
});
if (useWorkbookFlowStore.persist.hasHydrated()) {
  void restorePersistedFlow();
}

/** Flush the debounced runner snapshot (pause/leave paths and tests). */
export function flushWorkbookSnapshot(): void {
  persistSnapshotNow();
}

/** Test seam: drop the module-level runner between tests. */
export function resetWorkbookFlowForTest(): void {
  disposeRunner();
  useWorkbookFlowStore.setState({ ...clearedFlowSlice, prepared: null });
}
