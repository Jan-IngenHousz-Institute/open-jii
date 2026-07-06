import { cellById, firstExecutableCellId, isExecutable, nextCellId } from "../flow/flow-utils";
import { completeRun, failRun, landOn, markDownstreamStale, stampRun } from "./cell-entry";
import type { TransitionResult } from "./effects";
import type { RunnerState } from "./state";
import { currentAnswers, trace } from "./state";

function ignored(state: RunnerState, what: string): TransitionResult {
  return { state: trace(state, `ignored ${what} in ${state.status}`), effects: [] };
}

/**
 * Notebook RUN_CELL: force-run one cell. A branch cascades from its jump
 * target like a mini pass (web runCell parity); producers stop after
 * completion. Each invocation is a fresh pass for loop-cap purposes.
 */
export function handleRunCell(state: RunnerState, cellId: string): TransitionResult {
  if (state.status === "running" || state.status === "cancelling") {
    return ignored(state, "RUN_CELL");
  }
  const cell = cellById(state.cells, cellId);
  if (!cell || !isExecutable(cell)) return ignored(state, "RUN_CELL");
  // Web parity: running a markdown cell is a no-op, never a cascade.
  if (cell.type === "markdown") return ignored(state, "RUN_CELL");

  const next: RunnerState = {
    ...state,
    branchVisits: {},
    stopRequested: false,
    runAllActive: cell.type === "branch",
  };
  return landOn(next, cellId, "jump");
}

/** Notebook RUN_ALL: fresh pass over the whole document (web parity). */
export function handleRunAll(state: RunnerState): TransitionResult {
  if (state.status === "running" || state.status === "cancelling") {
    return ignored(state, "RUN_ALL");
  }
  const next: RunnerState = {
    ...state,
    cellRuns: {},
    execCounter: 0,
    branchVisits: {},
    stopRequested: false,
    runAllActive: true,
    progress: null,
  };
  return landOn(next, firstExecutableCellId(next.cells), "forward");
}

export function handleStop(state: RunnerState): TransitionResult {
  if (!state.runAllActive) return ignored(state, "STOP");
  return { state: { ...state, stopRequested: true }, effects: [] };
}

export function handleClearOutputs(state: RunnerState): TransitionResult {
  if (state.status === "running" || state.status === "cancelling") {
    return ignored(state, "CLEAR_OUTPUTS");
  }
  return {
    state: {
      ...state,
      outputs: {},
      cellRuns: {},
      execCounter: 0,
      progress: null,
      status: "idle",
      runAllActive: false,
      stopRequested: false,
      position: { cellId: null, enteredVia: "forward", atStart: false },
    },
    effects: [],
  };
}

/** Notebook ANSWER: any question cell; resumes a suspended pass. */
export function handleNotebookAnswer(
  state: RunnerState,
  cellId: string,
  value: string,
): TransitionResult {
  if (state.status === "running" || state.status === "cancelling") {
    return ignored(state, "ANSWER");
  }
  const cell = cellById(state.cells, cellId);
  if (cell?.type !== "question") return ignored(state, "ANSWER");

  const required = (cell.question as { required?: boolean }).required ?? false;
  const blank = value.trim() === "";
  if (required && blank) {
    return {
      state: failRun(
        trace(state, `ANSWER rejected: question ${cellId} is required`),
        cellId,
        "Answer required",
      ),
      effects: [],
    };
  }

  const existing = currentAnswers(state)[cellId];
  const changed = existing !== undefined && existing !== value;

  const answers = { ...currentAnswers(state) };
  if (blank) {
    delete answers[cellId];
  } else {
    answers[cellId] = value;
  }
  let next: RunnerState = {
    ...state,
    answersByCycle: state.answersByCycle.map((m, i) => (i === state.cycle ? answers : m)),
  };
  next = completeRun(stampRun(next, cellId), cellId);
  if (changed) next = markDownstreamStale(next, cellId);

  if (next.runAllActive && next.position.cellId === cellId) {
    return landOn(next, nextCellId(next.cells, cellId), "forward");
  }
  // Recording an off-position answer must not disturb a suspended pass.
  return {
    state: { ...next, status: next.runAllActive ? next.status : "idle" },
    effects: [],
  };
}
