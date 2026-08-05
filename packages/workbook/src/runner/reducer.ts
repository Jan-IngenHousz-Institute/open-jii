import { parseMacroArtifact } from "../artifact/macro-artifact";
import {
  cellById,
  dispatchStepId,
  firstExecutableCellId,
  isExecutable,
  nextCellId,
  prevCellId,
} from "../flow/flow-utils";
import type { OutputEntry } from "../flow/hydrate";
import {
  advanceDispatch,
  afterCellFailure,
  completeRun,
  failRun,
  ignored,
  isDispatchTarget,
  landOn,
  lastOrder,
  markDownstreamStale,
  ownerCellId,
  recordAnswer,
  setCellRun,
  stackTop,
  startArtifactDispatch,
  startResolvedProtocolCommand,
} from "./cell-entry";
import type { Effect, TransitionResult } from "./effects";
import type { WorkbookEvent, WorkbookInternalEvent } from "./events";
import { isInternalEvent } from "./events";
import type { RunnerState } from "./state";
import { createInitialState, currentAnswers, trace } from "./state";

function noop(state: RunnerState, line?: string): TransitionResult {
  return { state: line ? trace(state, line) : state, effects: [] };
}

// Most events behave identically in both modes; the mode split lives in these
// two gates alone. Flow owns the cursor vocabulary, notebook owns passes.
const FLOW_ONLY = new Set<WorkbookEvent["type"]>(["START", "NEXT", "BACK", "RETRY", "START_CYCLE"]);
const NOTEBOOK_ONLY = new Set<WorkbookEvent["type"]>(["RUN_ALL", "CLEAR_OUTPUTS"]);

// ── Shared handlers (mode-free) ─────────────────────

/**
 * ANSWER records on the target question (required questions reject blanks,
 * changed values mark downstream producers stale) and advances only when the
 * runtime is awaiting input at that exact cell: the current flow step, or a
 * suspended notebook pass. Off-target answers record without moving anything.
 */
function handleAnswer(state: RunnerState, cellId: string, value: string): TransitionResult {
  if (state.status === "running" || state.status === "cancelling") {
    return ignored(state, "ANSWER");
  }
  const awaitedHere = state.status === "awaitingInput" && state.position.cellId === cellId;
  const recording = recordAnswer(state, cellId, value);
  if (recording.kind === "rejected") return { state: recording.state, effects: [] };

  const next = recording.state;
  if (awaitedHere) return landOn(next, nextCellId(next.cells, cellId), "forward");
  if (state.mode === "notebook" && !next.runAllActive) {
    return { state: { ...next, status: "idle" }, effects: [] };
  }
  return { state: next, effects: [] };
}

/**
 * RUN_CELL navigates to the cell and force-runs it (explicit request). A
 * branch starts a fresh pass (visit caps reset) and cascades from its jump
 * target; markdown is navigation in flow and a no-op in notebook.
 */
function handleRunCell(state: RunnerState, cellId: string): TransitionResult {
  if (state.status === "running" || state.status === "cancelling") {
    return ignored(state, "RUN_CELL");
  }
  const cell = cellById(state.cells, cellId);
  if (!cell || !isExecutable(cell)) return ignored(state, "RUN_CELL");
  if (cell.type === "markdown" && state.mode === "notebook") return ignored(state, "RUN_CELL");

  const next: RunnerState = {
    ...state,
    branchVisits: cell.type === "branch" ? {} : state.branchVisits,
    stopRequested: false,
    runAllActive: state.mode === "notebook" && cell.type === "branch",
  };
  return landOn(next, cellId, "jump");
}

function handleStop(state: RunnerState): TransitionResult {
  if (!state.runAllActive) return ignored(state, "STOP");
  return { state: { ...state, stopRequested: true }, effects: [] };
}

function handleCancel(state: RunnerState): TransitionResult {
  if (state.status === "running" && state.inFlight) {
    const effects: Effect[] = [{ kind: "cancelEffects", effectIds: [state.inFlight.effectId] }];
    return { state: { ...state, status: "cancelling" }, effects };
  }
  if (state.status === "awaitingInput" && state.runAllActive) {
    return {
      state: { ...trace(state, "pass aborted"), runAllActive: false, stopRequested: false },
      effects: [],
    };
  }
  if (state.status === "pausedError") {
    // Re-arm the failed cell without retrying it.
    const cur = state.position.cellId;
    let next: RunnerState = { ...state, status: "awaitingInput" };
    if (cur !== null) {
      const cellRuns = { ...next.cellRuns };
      delete cellRuns[cur];
      delete cellRuns[dispatchStepId(cur)];
      next = { ...next, cellRuns };
    }
    return { state: next, effects: [] };
  }
  return ignored(state, "CANCEL");
}

function handleReset(state: RunnerState): TransitionResult {
  const effects: Effect[] =
    state.inFlight !== null
      ? [{ kind: "cancelEffects", effectIds: [state.inFlight.effectId] }]
      : [];
  const fresh = createInitialState({
    cells: state.cells,
    mode: state.mode,
    loop: state.options.loop,
    maxBranchVisits: state.options.maxBranchVisits,
    allowDeviceWrites: state.options.allowDeviceWrites,
    deviceFamily: state.options.deviceFamily,
    devices: state.devices,
  });
  // effectSeq survives so completions from before the reset can never match.
  return { state: { ...fresh, effectSeq: state.effectSeq }, effects };
}

// ── Flow navigation handlers ────────────────────────

function requiredUnanswered(state: RunnerState, cellId: string): boolean {
  const cell = cellById(state.cells, cellId);
  if (cell?.type !== "question") return false;
  const required = (cell.question as { required?: boolean }).required ?? false;
  const answer = currentAnswers(state)[cellId];
  return required && (answer === undefined || answer.trim() === "");
}

function handleStart(state: RunnerState): TransitionResult {
  if (state.status !== "idle" || state.position.cellId !== null) {
    return ignored(state, "START");
  }
  return landOn(state, firstExecutableCellId(state.cells), "forward");
}

function handleNext(state: RunnerState): TransitionResult {
  if (state.status !== "awaitingInput") return ignored(state, "NEXT");
  const cur = state.position.cellId;
  if (cur === null) return ignored(state, "NEXT");
  const cell = cellById(state.cells, cur);
  if (!cell) return ignored(state, "NEXT");

  if (cell.type === "markdown") {
    return landOn(state, nextCellId(state.cells, cur), "forward");
  }
  if (cell.type === "question") {
    if (requiredUnanswered(state, cur)) {
      return {
        state: trace(state, `NEXT blocked: question ${cur} requires an answer`),
        effects: [],
      };
    }
    return landOn(state, nextCellId(state.cells, cur), "forward");
  }
  if (cell.type === "branch") {
    // Back landed here defensively; walking forward re-evaluates the branch.
    return landOn(state, cur, "forward");
  }
  // Producers: forward step-over is only allowed once the cell has completed.
  if (state.cellRuns[cur]?.status === "completed") {
    return landOn(state, nextCellId(state.cells, cur), "forward");
  }
  return ignored(state, "NEXT");
}

function handleBack(state: RunnerState): TransitionResult {
  if (state.status !== "awaitingInput" && state.status !== "pausedError") {
    return ignored(state, "BACK");
  }
  const cur = state.position.cellId;
  if (cur === null) return ignored(state, "BACK");

  let next = state;
  let target: string | null;
  const top = stackTop(next.returnStack);
  if (top?.landingCellId === cur) {
    next = { ...next, returnStack: next.returnStack.slice(0, -1) };
    target = top.returnToCellId;
  } else {
    target = prevCellId(next.cells, cur);
  }
  // Back never lands on a branch; step over to its predecessor.
  while (target !== null && cellById(next.cells, target)?.type === "branch") {
    target = prevCellId(next.cells, target);
  }

  if (target === null) {
    return {
      state: {
        ...next,
        status: "awaitingInput",
        position: { ...next.position, atStart: true },
      },
      effects: [],
    };
  }
  return landOn(next, target, "back");
}

function handleRetry(state: RunnerState): TransitionResult {
  const cur = state.position.cellId;
  if (cur === null) return ignored(state, "RETRY");
  const run = state.cellRuns[cur];
  const retryable =
    state.status === "pausedError" ||
    (state.status === "awaitingInput" &&
      (run?.status === "cancelled" || run?.status === "interrupted" || run?.status === "error"));
  if (!retryable) return ignored(state, "RETRY");
  const cell = cellById(state.cells, cur);
  if (!cell || cell.type === "markdown" || cell.type === "question") {
    return ignored(state, "RETRY");
  }
  return landOn(state, cur, "jump");
}

/** Explicit new iteration: cycle wrap plus outputs cleared (mobile parity). */
function handleStartCycle(state: RunnerState): TransitionResult {
  if (
    state.status !== "awaitingInput" &&
    state.status !== "pausedError" &&
    state.status !== "done"
  ) {
    return ignored(state, "START_CYCLE");
  }
  const wrapped: RunnerState = {
    ...trace(state, `cycle ${state.cycle + 1} start (explicit)`),
    cycle: state.cycle + 1,
    answersByCycle: [...state.answersByCycle, {}],
    outputs: {},
    branchVisits: {},
    returnStack: [],
    cellRuns: {},
    dispatch: null,
    dispatchConsumed: {},
    progress: null,
  };
  return landOn(wrapped, firstExecutableCellId(wrapped.cells), "forward");
}

/** Host roster sync; read at the next producer/branch start, mode-free. */
function handleSetDevices(state: RunnerState, devices: RunnerState["devices"]): TransitionResult {
  return { state: { ...state, devices }, effects: [] };
}

// ── Notebook pass handlers ──────────────────────────

/** RUN_ALL: fresh pass over the whole document (web parity). */
function handleRunAll(state: RunnerState): TransitionResult {
  if (state.status === "running" || state.status === "cancelling") {
    return ignored(state, "RUN_ALL");
  }
  const next: RunnerState = {
    ...state,
    cellRuns: {},
    execCounter: 0,
    branchVisits: {},
    dispatch: null,
    dispatchConsumed: {},
    stopRequested: false,
    runAllActive: true,
    progress: null,
  };
  return landOn(next, firstExecutableCellId(next.cells), "forward");
}

function handleClearOutputs(state: RunnerState): TransitionResult {
  if (state.status === "running" || state.status === "cancelling") {
    return ignored(state, "CLEAR_OUTPUTS");
  }
  return {
    state: {
      ...state,
      outputs: {},
      cellRuns: {},
      execCounter: 0,
      dispatch: null,
      dispatchConsumed: {},
      progress: null,
      status: "idle",
      runAllActive: false,
      stopRequested: false,
      position: { cellId: null, enteredVia: "forward", atStart: false },
    },
    effects: [],
  };
}

// ── Internal completions ────────────────────────────

/** Continue after a producer (or its dispatch step) finished successfully. */
function continueAfterCompletion(state: RunnerState, flowCellId: string): TransitionResult {
  if (state.mode === "flow" || state.runAllActive) {
    return landOn(state, nextCellId(state.cells, flowCellId), "forward");
  }
  return { state: { ...state, status: "idle" }, effects: [] };
}

/** Store the output, clear the in-flight slot, and complete the run record. */
function recordCompletion(
  state: RunnerState,
  cellId: string,
  entry: OutputEntry,
  timings: { startedAt: number; endedAt: number },
): RunnerState {
  const next: RunnerState = {
    ...state,
    inFlight: null,
    progress: null,
    outputs: { ...state.outputs, [cellId]: entry },
  };
  return completeRun(next, cellId, timings.endedAt - timings.startedAt);
}

/** Finalize a cancel: no output, no error, the cell re-arms at ready. */
function finalizeCancel(state: RunnerState, effectCellId: string): TransitionResult {
  const owner = ownerCellId(effectCellId);
  let next = state;
  const mark = (id: string) => {
    const prev = next.cellRuns[id];
    next = setCellRun(next, id, {
      status: "cancelled",
      executionOrder: prev?.executionOrder ?? [],
    });
  };
  mark(effectCellId);
  if (owner !== effectCellId) mark(owner);
  next = {
    ...trace(next, `cancelled ${effectCellId}`),
    inFlight: null,
    progress: null,
    dispatch: null,
    dispatchConsumed: {},
    runAllActive: false,
    stopRequested: false,
  };
  if (next.mode === "flow") {
    return {
      state: { ...next, status: "awaitingInput", position: { ...next.position, cellId: owner } },
      effects: [],
    };
  }
  return { state: { ...next, status: "idle" }, effects: [] };
}

function failEffect(
  state: RunnerState,
  effectCellId: string,
  error: string,
  extra?: { deviceResults?: OutputEntry["deviceResults"]; messages?: string[] },
): TransitionResult {
  const owner = ownerCellId(effectCellId);
  let next = failRun(state, effectCellId, error);
  if (extra?.deviceResults) {
    // Total multi-device failure keeps the per-device errors on the output.
    next = {
      ...next,
      outputs: {
        ...next.outputs,
        [effectCellId]: {
          v: undefined,
          deviceResults: extra.deviceResults,
          messages: extra.messages,
        },
      },
    };
  }
  if (isDispatchTarget(next, effectCellId)) {
    // One dispatch group failing must not halt the other groups.
    return advanceDispatch(next);
  }
  if (owner !== effectCellId) {
    // Mirror dispatch-step failures onto the macro cell hosts render.
    const prev = next.cellRuns[owner];
    next = setCellRun(next, owner, {
      status: "error",
      error,
      executionOrder: prev?.executionOrder ?? [],
    });
  }
  return afterCellFailure(next, owner);
}

function handleInternal(state: RunnerState, event: WorkbookInternalEvent): TransitionResult {
  if (state.inFlight?.effectId !== event.effectId) {
    // Stale completion: cancel races, re-runs, restores. Never record it.
    return noop(state, `dropped stale ${event.type} (${event.effectId})`);
  }

  if (event.type === "EFFECT_CANCELLED") {
    return finalizeCancel(state, event.cellId);
  }
  if (state.status === "cancelling") {
    if (event.type === "COMMAND_PROGRESS") return noop(state);
    return finalizeCancel(state, event.cellId);
  }

  switch (event.type) {
    case "COMMAND_PROGRESS":
      return { state: { ...state, progress: event.progress }, effects: [] };

    case "CODE_RESOLVED": {
      if (!event.code || event.code.length === 0) {
        const cleared: RunnerState = { ...state, inFlight: null, progress: null };
        return failEffect(cleared, event.cellId, "Invalid or missing protocol JSON");
      }
      return startResolvedProtocolCommand(state, event.cellId, event.code);
    }

    case "CODE_RESOLVE_FAILED": {
      const cleared: RunnerState = { ...state, inFlight: null, progress: null };
      return failEffect(cleared, event.cellId, event.error);
    }

    case "MACRO_FAILED":
    case "COMMAND_FAILED": {
      const cleared: RunnerState = { ...state, inFlight: null, progress: null };
      return failEffect(cleared, event.cellId, event.error, {
        deviceResults: event.deviceResults,
        messages: event.messages,
      });
    }

    case "MACRO_DONE": {
      const next = recordCompletion(
        state,
        event.cellId,
        { v: event.output, deviceResults: event.deviceResults, messages: event.messages },
        event.timings,
      );
      // Artifact constructors are a single-device flow feature; a fanned-out
      // macro's per-device outputs are always plain data.
      const artifact = event.deviceResults ? null : parseMacroArtifact(event.output);
      if (artifact !== null) {
        const dispatch = startArtifactDispatch(next, event.cellId, artifact);
        if (dispatch.state.cellRuns[event.cellId]?.status === "error") {
          return afterCellFailure(dispatch.state, event.cellId);
        }
        return dispatch;
      }
      return continueAfterCompletion(markDownstreamStale(next, event.cellId), event.cellId);
    }

    case "COMMAND_DONE": {
      const owner = ownerCellId(event.cellId);
      let next = recordCompletion(
        state,
        event.cellId,
        { v: event.output, deviceResults: event.deviceResults, messages: event.messages },
        event.timings,
      );
      // For a dispatch step the owning macro's document position anchors the
      // stale sweep, but the step's own stamp is the freshness reference.
      next = markDownstreamStale(next, owner, lastOrder(next.cellRuns[event.cellId]));
      if (isDispatchTarget(next, event.cellId)) {
        return advanceDispatch(next);
      }
      return continueAfterCompletion(next, owner);
    }
  }
}

export function transition(state: RunnerState, event: WorkbookEvent): TransitionResult {
  if (state.status === "fatal") return noop(state);
  if (isInternalEvent(event)) return handleInternal(state, event);

  if (state.mode === "notebook" && FLOW_ONLY.has(event.type)) return ignored(state, event.type);
  if (state.mode === "flow" && NOTEBOOK_ONLY.has(event.type)) return ignored(state, event.type);

  switch (event.type) {
    case "ANSWER":
      return handleAnswer(state, event.cellId, event.value);
    case "RUN_CELL":
      return handleRunCell(state, event.cellId);
    case "CANCEL":
      return handleCancel(state);
    case "RESET":
      return handleReset(state);
    case "STOP":
      return handleStop(state);
    case "START":
      return handleStart(state);
    case "NEXT":
      return handleNext(state);
    case "BACK":
      return handleBack(state);
    case "RETRY":
      return handleRetry(state);
    case "START_CYCLE":
      return handleStartCycle(state);
    case "RUN_ALL":
      return handleRunAll(state);
    case "CLEAR_OUTPUTS":
      return handleClearOutputs(state);
    case "SET_DEVICES":
      return handleSetDevices(state, event.devices);
  }
}
