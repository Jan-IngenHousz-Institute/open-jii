import { parseMacroArtifact } from "../artifact/macro-artifact";
import { dispatchStepId, nextCellId } from "../flow/flow-utils";
import {
  afterCellFailure,
  completeRun,
  failRun,
  landOn,
  lastOrder,
  markDownstreamStale,
  ownerCellId,
  startArtifactDispatch,
  startResolvedProtocolCommand,
} from "./cell-entry";
import type { Effect, TransitionResult } from "./effects";
import type { WorkbookEvent, WorkbookInternalEvent } from "./events";
import { isInternalEvent } from "./events";
import {
  handleAnswer,
  handleBack,
  handleFlowRunCell,
  handleNext,
  handleRetry,
  handleStart,
  handleStartCycle,
} from "./reducer-flow";
import {
  handleClearOutputs,
  handleNotebookAnswer,
  handleRunAll,
  handleRunCell,
  handleStop,
} from "./reducer-notebook";
import type { CellRunState, RunnerState } from "./state";
import { createInitialState, trace } from "./state";

function noop(state: RunnerState, line?: string): TransitionResult {
  return { state: line ? trace(state, line) : state, effects: [] };
}

function setRun(state: RunnerState, cellId: string, run: CellRunState): RunnerState {
  return { ...state, cellRuns: { ...state.cellRuns, [cellId]: run } };
}

/** Continue after a producer (or its dispatch step) finished successfully. */
function continueAfterCompletion(state: RunnerState, flowCellId: string): TransitionResult {
  if (state.mode === "flow") {
    return landOn(state, nextCellId(state.cells, flowCellId), "forward");
  }
  if (state.runAllActive) {
    return landOn(state, nextCellId(state.cells, flowCellId), "forward");
  }
  return { state: { ...state, status: "idle" }, effects: [] };
}

/** Finalize a cancel: no output, no error, the cell re-arms at ready. */
function finalizeCancel(state: RunnerState, effectCellId: string): TransitionResult {
  const owner = ownerCellId(effectCellId);
  let next = state;
  const mark = (id: string) => {
    const prev = next.cellRuns[id];
    next = setRun(next, id, {
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

function failEffect(state: RunnerState, effectCellId: string, error: string): TransitionResult {
  const owner = ownerCellId(effectCellId);
  let next = failRun(state, effectCellId, error);
  if (owner !== effectCellId) {
    // Mirror dispatch-step failures onto the macro cell hosts render.
    const prev = next.cellRuns[owner];
    next = setRun(next, owner, {
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
        const failed = failRun(state, event.cellId, "Invalid or missing protocol code");
        return afterCellFailure({ ...failed, inFlight: null, progress: null }, event.cellId);
      }
      return startResolvedProtocolCommand(state, event.cellId, event.code);
    }

    case "CODE_RESOLVE_FAILED":
    case "MACRO_FAILED":
    case "COMMAND_FAILED": {
      const cleared: RunnerState = { ...state, inFlight: null, progress: null };
      return failEffect(cleared, event.cellId, event.error);
    }

    case "MACRO_DONE": {
      const elapsed = event.timings.endedAt - event.timings.startedAt;
      let next: RunnerState = {
        ...state,
        inFlight: null,
        progress: null,
        outputs: { ...state.outputs, [event.cellId]: { v: event.output } },
      };
      next = completeRun(next, event.cellId, elapsed);
      const artifact = parseMacroArtifact(event.output);
      if (artifact !== null) {
        const dispatch = startArtifactDispatch(next, event.cellId, artifact);
        if (dispatch.state.cellRuns[event.cellId]?.status === "error") {
          return afterCellFailure(dispatch.state, event.cellId);
        }
        return dispatch;
      }
      next = markDownstreamStale(next, event.cellId);
      return continueAfterCompletion(next, event.cellId);
    }

    case "COMMAND_DONE": {
      const elapsed = event.timings.endedAt - event.timings.startedAt;
      const owner = ownerCellId(event.cellId);
      let next: RunnerState = {
        ...state,
        inFlight: null,
        progress: null,
        outputs: { ...state.outputs, [event.cellId]: { v: event.output } },
      };
      next = completeRun(next, event.cellId, elapsed);
      if (owner !== event.cellId) {
        // Dispatch done: the owning macro cell already completed.
        next = markDownstreamStale(next, owner, lastOrder(next.cellRuns[event.cellId]));
      } else {
        next = markDownstreamStale(next, owner);
      }
      return continueAfterCompletion(next, owner);
    }
  }
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
  return noop(state, `ignored CANCEL in ${state.status}`);
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
  });
  // effectSeq survives so completions from before the reset can never match.
  return { state: { ...fresh, effectSeq: state.effectSeq }, effects };
}

export function transition(state: RunnerState, event: WorkbookEvent): TransitionResult {
  if (state.status === "fatal") return noop(state);

  if (isInternalEvent(event)) return handleInternal(state, event);

  switch (event.type) {
    case "CANCEL":
      return handleCancel(state);
    case "RESET":
      return handleReset(state);
    case "STOP":
      return handleStop(state);
    case "RUN_CELL":
      return state.mode === "flow"
        ? handleFlowRunCell(state, event.cellId)
        : handleRunCell(state, event.cellId);
    case "ANSWER":
      return state.mode === "flow"
        ? handleAnswer(state, event.cellId, event.value)
        : handleNotebookAnswer(state, event.cellId, event.value);
    case "RUN_ALL":
      return state.mode === "notebook"
        ? handleRunAll(state)
        : noop(state, "ignored RUN_ALL in flow mode");
    case "CLEAR_OUTPUTS":
      return state.mode === "notebook"
        ? handleClearOutputs(state)
        : noop(state, "ignored CLEAR_OUTPUTS in flow mode");
    case "START":
      return state.mode === "flow"
        ? handleStart(state)
        : noop(state, "ignored START in notebook mode");
    case "NEXT":
      return state.mode === "flow"
        ? handleNext(state)
        : noop(state, "ignored NEXT in notebook mode");
    case "BACK":
      return state.mode === "flow"
        ? handleBack(state)
        : noop(state, "ignored BACK in notebook mode");
    case "RETRY":
      return state.mode === "flow"
        ? handleRetry(state)
        : noop(state, "ignored RETRY in notebook mode");
    case "START_CYCLE":
      return state.mode === "flow"
        ? handleStartCycle(state)
        : noop(state, "ignored START_CYCLE in notebook mode");
  }
}
