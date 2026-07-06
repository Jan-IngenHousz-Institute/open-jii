import {
  cellById,
  firstExecutableCellId,
  isExecutable,
  nextCellId,
  prevCellId,
} from "../flow/flow-utils";
import {
  completeRun,
  failRun,
  landOn,
  markDownstreamStale,
  stackTop,
  stampRun,
} from "./cell-entry";
import type { TransitionResult } from "./effects";
import type { RunnerState } from "./state";
import { currentAnswers, trace } from "./state";

function ignored(state: RunnerState, what: string): TransitionResult {
  return { state: trace(state, `ignored ${what} in ${state.status}`), effects: [] };
}

function requiredUnanswered(state: RunnerState, cellId: string): boolean {
  const cell = cellById(state.cells, cellId);
  if (cell?.type !== "question") return false;
  const required = (cell.question as { required?: boolean }).required ?? false;
  const answer = currentAnswers(state)[cellId];
  return required && (answer === undefined || answer.trim() === "");
}

export function handleStart(state: RunnerState): TransitionResult {
  if (state.status !== "idle" || state.position.cellId !== null) {
    return ignored(state, "START");
  }
  return landOn(state, firstExecutableCellId(state.cells), "forward");
}

export function handleNext(state: RunnerState): TransitionResult {
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

export function handleAnswer(state: RunnerState, cellId: string, value: string): TransitionResult {
  if (state.status !== "awaitingInput") return ignored(state, "ANSWER");
  if (state.position.cellId !== cellId) {
    return { state: trace(state, `ignored ANSWER for non-current cell ${cellId}`), effects: [] };
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

  return landOn(next, nextCellId(next.cells, cellId), "forward");
}

export function handleBack(state: RunnerState): TransitionResult {
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

export function handleRetry(state: RunnerState): TransitionResult {
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
export function handleStartCycle(state: RunnerState): TransitionResult {
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
    progress: null,
  };
  return landOn(wrapped, firstExecutableCellId(wrapped.cells), "forward");
}

/** Flow RUN_CELL: navigate to the cell and force-run it (explicit request). */
export function handleFlowRunCell(state: RunnerState, cellId: string): TransitionResult {
  if (state.status === "running" || state.status === "cancelling") {
    return ignored(state, "RUN_CELL");
  }
  const cell = cellById(state.cells, cellId);
  if (!cell || !isExecutable(cell)) return ignored(state, "RUN_CELL");
  return landOn(state, cellId, "jump");
}
