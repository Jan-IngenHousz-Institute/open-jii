import type { BranchCell } from "@repo/api/schemas/workbook-cells.schema";
import { evaluateBranch } from "@repo/api/utils/evaluate-branch";
import { validateCommandArtifact } from "@repo/iot";
import type { SensorFamily } from "@repo/iot";

import type { MacroArtifact } from "../artifact/macro-artifact";
import { isCommandCell } from "../cells";
import { validateInlineCommand } from "../command/command-payload";
import {
  cellById,
  cellIndex,
  DISPATCH_STEP_SUFFIX,
  dispatchStepId,
  firstExecutableCellId,
  isProducer,
  nearestUpstreamProducerId,
  nextCellId,
  prevCellId,
  resolveGotoCellId,
} from "../flow/flow-utils";
import { asWorkbookCells, hydrateCells } from "../flow/hydrate";
import { buildCellNamespace } from "../namespace/build-cell-namespace";
import type { CommandSource, ResolvedCommandValue } from "../ports";
import type { Effect, TransitionResult } from "./effects";
import type { CellRunState, EffectKind, EnteredVia, RunnerState } from "./state";
import { currentAnswers, trace } from "./state";

export function setCellRun(state: RunnerState, cellId: string, run: CellRunState): RunnerState {
  return { ...state, cellRuns: { ...state.cellRuns, [cellId]: run } };
}

/** Unaccepted events are no-ops that only leave a trace line. */
export function ignored(state: RunnerState, what: string): TransitionResult {
  return { state: trace(state, `ignored ${what} in ${state.status}`), effects: [] };
}

export function lastOrder(run: CellRunState | undefined): number {
  return run?.executionOrder[run.executionOrder.length - 1] ?? 0;
}

export function stackTop<T>(arr: T[]): T | undefined {
  return arr.length > 0 ? arr[arr.length - 1] : undefined;
}

/** Start a run: assign the next Jupyter counter and mark the cell running. */
export function stampRun(state: RunnerState, cellId: string): RunnerState {
  const execCounter = state.execCounter + 1;
  const prev = state.cellRuns[cellId];
  return {
    ...setCellRun({ ...state, execCounter }, cellId, {
      status: "running",
      executionOrder: [...(prev?.executionOrder ?? []), execCounter],
    }),
  };
}

export function isAtStart(state: RunnerState, cellId: string): boolean {
  return prevCellId(state.cells, cellId) === null && state.returnStack.length === 0;
}

/** The flow cell a synthetic dispatch step belongs to (identity otherwise). */
export function ownerCellId(effectCellId: string): string {
  return effectCellId.endsWith(DISPATCH_STEP_SUFFIX)
    ? effectCellId.slice(0, -DISPATCH_STEP_SUFFIX.length)
    : effectCellId;
}

export function completeRun(
  state: RunnerState,
  cellId: string,
  executionTimeMs?: number,
): RunnerState {
  const prev = state.cellRuns[cellId];
  return setCellRun(state, cellId, {
    status: "completed",
    executionOrder: prev?.executionOrder ?? [],
    executionTimeMs,
    lastMatchedPathId: prev?.lastMatchedPathId,
  });
}

/**
 * Downstream stale marking, web's model: after `originCellId` completes a run,
 * every producer later in document order whose last completed run predates the
 * origin's latest stamp goes stale. Outputs are kept; stale only re-arms the
 * cell. Branch/markdown/output/question cells never go stale. Document order
 * over-marks safely; a reference-based policy can replace this function later.
 */
export function markDownstreamStale(
  state: RunnerState,
  originCellId: string,
  originStamp: number = lastOrder(state.cellRuns[originCellId]),
): RunnerState {
  if (originStamp === 0) return state;
  const origin = cellIndex(state.cells, originCellId);
  if (origin < 0) return state;

  let cellRuns = state.cellRuns;
  for (let i = origin + 1; i < state.cells.length; i++) {
    const cell = state.cells[i];
    if (!isProducer(cell)) continue;
    const run = cellRuns[cell.id];
    if (run?.status === "completed" && lastOrder(run) < originStamp) {
      cellRuns = { ...cellRuns, [cell.id]: { ...run, status: "stale" } };
    }
  }
  return cellRuns === state.cellRuns ? state : { ...state, cellRuns };
}

/** Mint the next effect id, set inFlight, and emit the effect built from it. */
function emitEffect(
  state: RunnerState,
  cellId: string,
  kind: EffectKind,
  build: (effectId: string) => Effect,
): TransitionResult {
  const effectSeq = state.effectSeq + 1;
  const effectId = `e${effectSeq}`;
  return {
    state: { ...state, effectSeq, inFlight: { effectId, cellId, kind } },
    effects: [build(effectId)],
  };
}

function emitRunCommand(
  state: RunnerState,
  cellId: string,
  command: ResolvedCommandValue,
  family: SensorFamily,
  source: CommandSource,
): TransitionResult {
  return emitEffect(state, cellId, "runCommand", (effectId) => ({
    kind: "runCommand",
    effectId,
    cellId,
    input: { cellId, command, family, source },
  }));
}

export type AnswerRecording =
  | { kind: "rejected"; state: RunnerState }
  | { kind: "recorded"; state: RunnerState };

/**
 * Validate and record an answer on the current cycle (shared by both modes):
 * required questions reject blank values, blank optional answers delete the
 * key, the question gets a run stamp, and a CHANGED value marks downstream
 * producers stale.
 */
export function recordAnswer(state: RunnerState, cellId: string, value: string): AnswerRecording {
  const cell = cellById(state.cells, cellId);
  if (cell?.type !== "question") {
    return { kind: "rejected", state: ignored(state, "ANSWER").state };
  }

  const required = (cell.question as { required?: boolean }).required ?? false;
  const blank = value.trim() === "";
  if (required && blank) {
    return {
      kind: "rejected",
      state: failRun(
        trace(state, `ANSWER rejected: question ${cellId} is required`),
        cellId,
        "Answer required",
      ),
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
  return { kind: "recorded", state: next };
}

/** Record a per-cell failure; mode decides pause vs continue at the call site. */
export function failRun(
  state: RunnerState,
  cellId: string,
  error: string,
  executionTimeMs?: number,
): RunnerState {
  const prev = state.cellRuns[cellId];
  const outputs = { ...state.outputs };
  delete outputs[cellId];
  return setCellRun({ ...state, outputs }, cellId, {
    status: "error",
    error,
    executionOrder: prev?.executionOrder ?? [],
    executionTimeMs,
  });
}

function producerFamily(state: RunnerState): "multispeq" | "ambit" | "generic" {
  return state.options.deviceFamily ?? "generic";
}

/**
 * Emit the effect(s) that start a producer cell. Protocol cells chain through
 * code resolution; inline command cells validate synchronously; macros get the
 * verbatim upstream `json` plus the normalized ctx namespace.
 */
export function startProducer(state: RunnerState, cellId: string): TransitionResult {
  const cell = cellById(state.cells, cellId);
  if (!cell) return fatal(state, `startProducer: unknown cell ${cellId}`);

  let next = stampRun(state, cellId);
  next = { ...next, status: "running", progress: null };

  if (cell.type === "protocol") {
    return emitEffect(next, cellId, "resolveProtocolCode", (effectId) => ({
      kind: "resolveProtocolCode",
      effectId,
      cellId,
      protocolId: cell.payload.protocolId,
      version: cell.payload.version,
    }));
  }

  if (isCommandCell(cell)) {
    const resolved = validateInlineCommand(cell.payload);
    if (!resolved.ok) {
      return { state: failRun(next, cellId, resolved.error), effects: [] };
    }
    return emitRunCommand(next, cellId, resolved.value, producerFamily(next), {
      kind: "inlineCell",
      format: cell.payload.format,
    });
  }

  if (cell.type === "macro") {
    const upstreamId = nearestUpstreamProducerId(next.cells, cellId);
    const json = upstreamId ? (next.outputs[upstreamId]?.v ?? null) : null;
    const hydrated = hydrateCells(next.cells, currentAnswers(next), next.outputs);
    const ctx = buildCellNamespace(hydrated, cellIndex(next.cells, cellId));
    return emitEffect(next, cellId, "runMacro", (effectId) => ({
      kind: "runMacro",
      effectId,
      cellId,
      input: { cellId, macroId: cell.payload.macroId, language: cell.payload.language, json, ctx },
    }));
  }

  return fatal(state, `startProducer: cell ${cellId} is not a producer`);
}

/** Second step of a protocol cell: run the resolved code as a command. */
export function startResolvedProtocolCommand(
  state: RunnerState,
  cellId: string,
  code: Record<string, unknown>[],
): TransitionResult {
  const cell = cellById(state.cells, cellId);
  if (cell?.type !== "protocol") return fatal(state, `resolved code for non-protocol ${cellId}`);
  return emitRunCommand(state, cellId, code, producerFamily(state), {
    kind: "protocolCell",
    protocolId: cell.payload.protocolId,
    version: cell.payload.version,
  });
}

/**
 * Validated macro artifact -> synthetic dispatch step. Position stays at the
 * macro cell; the dispatch step id owns the in-flight effect and its output.
 */
export function startArtifactDispatch(
  state: RunnerState,
  macroCellId: string,
  artifact: MacroArtifact,
): TransitionResult {
  const validated = validateCommandArtifact(artifact, {
    family: state.options.deviceFamily,
    allowDeviceWrites: state.options.allowDeviceWrites,
  });
  if (!validated.ok) {
    return { state: failRun(state, macroCellId, validated.reason), effects: [] };
  }

  const stepId = dispatchStepId(macroCellId);
  let next = stampRun(state, stepId);
  next = {
    ...trace(next, `dispatch ${artifact.__ojArtifact} constructed by ${macroCellId}`),
    status: "running",
    progress: null,
  };
  return emitRunCommand(next, stepId, validated.command, validated.family, {
    kind: "artifact",
    artifact: artifact.__ojArtifact,
    producedBy: macroCellId,
  });
}

function fatal(state: RunnerState, reason: string): TransitionResult {
  return {
    state: { ...trace(state, `fatal: ${reason}`), status: "fatal", fatalReason: reason },
    effects: [],
  };
}

interface BranchResolution {
  state: RunnerState;
  nextCellId: string | null;
  jumped: boolean;
}

/**
 * Pure branch routing: loop-cap check before increment (the 100th visit
 * routes, the 101st falls through), production evaluateBranch over hydrated
 * cells, first match wins, sequential fall-through otherwise. Every forward
 * resolution records a return-stack entry so Back never lands on a branch;
 * chained branches replace the top entry; backward jumps record nothing.
 */
function resolveBranch(
  state: RunnerState,
  cell: BranchCell,
  enteredVia: EnteredVia,
): BranchResolution {
  const visits = state.branchVisits[cell.id] ?? 0;
  if (visits >= state.options.maxBranchVisits) {
    const next = trace(state, `branch ${cell.id} capped`);
    return { state: next, nextCellId: nextCellId(next.cells, cell.id), jumped: false };
  }

  let next: RunnerState = {
    ...state,
    branchVisits: { ...state.branchVisits, [cell.id]: visits + 1 },
  };

  const hydrated = hydrateCells(next.cells, currentAnswers(next), next.outputs);
  const matched = evaluateBranch(cell, asWorkbookCells(hydrated));

  next = setCellRun(next, cell.id, {
    status: "completed",
    executionOrder: next.cellRuns[cell.id]?.executionOrder ?? [],
    lastMatchedPathId: matched?.id,
  });

  const branchIdx = cellIndex(next.cells, cell.id);
  let target: string | null = null;
  let jumped = false;
  if (matched?.gotoCellId && matched.gotoCellId !== cell.id) {
    const resolved = resolveGotoCellId(next.cells, matched.gotoCellId);
    if (resolved !== null) {
      target = resolved;
      jumped = true;
    }
  }
  target ??= nextCellId(next.cells, cell.id);

  if (next.mode === "flow" && target !== null) {
    const targetIdx = cellIndex(next.cells, target);
    const backward = jumped && targetIdx < branchIdx;
    if (!backward) {
      const returnTo = prevCellId(next.cells, cell.id);
      const top = stackTop(next.returnStack);
      const chained = enteredVia === "jump" && top?.landingCellId === cell.id;
      const entry = chained
        ? { landingCellId: target, returnToCellId: top.returnToCellId }
        : { landingCellId: target, returnToCellId: returnTo };
      const returnStack = chained
        ? [...next.returnStack.slice(0, -1), entry]
        : [...next.returnStack, entry];
      next = { ...next, returnStack };
    }
  }

  return { state: next, nextCellId: target, jumped };
}

function endOfFlow(state: RunnerState): { state: RunnerState; continueAt: string | null } {
  if (state.mode === "notebook" || !state.options.loop) {
    const done = state.mode === "flow";
    return {
      state: {
        ...state,
        status: done ? "done" : "idle",
        runAllActive: false,
        stopRequested: false,
        position: { cellId: null, enteredVia: "forward", atStart: false },
      },
      continueAt: null,
    };
  }
  // Cycle wrap: fresh answers map and run records; outputs and the Jupyter
  // counter survive (mobile keeps scanResult across the wrap).
  const wrapped: RunnerState = {
    ...trace(state, `cycle ${state.cycle + 1} start`),
    cycle: state.cycle + 1,
    answersByCycle: [...state.answersByCycle, {}],
    branchVisits: {},
    returnStack: [],
    cellRuns: {},
  };
  return { state: wrapped, continueAt: firstExecutableCellId(wrapped.cells) };
}

/**
 * Move to a cell and process until the runtime suspends: interactive cells
 * await input, producers go running (single in-flight effect), branches route
 * inline. Iterative on purpose; branch loops are bounded by the visit cap.
 *
 * Entry semantics: "forward" applies the skip rule (completed and not stale
 * passes through, everything else runs), "jump" always runs (a branch loop
 * means re-measure), "back" is passive and never emits effects.
 */
export function landOn(
  state: RunnerState,
  cellId: string | null,
  via: EnteredVia,
): TransitionResult {
  let current = cellId;
  let entryVia = via;
  let s = state;

  for (;;) {
    if (s.runAllActive && s.stopRequested) {
      return {
        state: {
          ...trace(s, "pass stopped"),
          status: "idle",
          runAllActive: false,
          stopRequested: false,
          position: { cellId: current, enteredVia: entryVia, atStart: false },
        },
        effects: [],
      };
    }

    if (current === null) {
      const ended = endOfFlow(s);
      if (ended.continueAt === null) return { state: ended.state, effects: [] };
      s = ended.state;
      current = ended.continueAt;
      entryVia = "forward";
      continue;
    }

    const cell = cellById(s.cells, current);
    if (!cell) return fatal(s, `unknown cell ${current}`);

    s = {
      ...s,
      position: { cellId: current, enteredVia: entryVia, atStart: isAtStart(s, current) },
    };

    if (cell.type === "markdown") {
      if (s.mode === "notebook") {
        current = nextCellId(s.cells, current);
        entryVia = "forward";
        continue;
      }
      return { state: { ...s, status: "awaitingInput" }, effects: [] };
    }

    if (cell.type === "question") {
      return { state: { ...s, status: "awaitingInput" }, effects: [] };
    }

    if (cell.type === "branch") {
      if (entryVia === "back") {
        return { state: { ...s, status: "awaitingInput" }, effects: [] };
      }
      const resolved = resolveBranch(s, cell, entryVia);
      s = resolved.state;
      if (s.status === "fatal") return { state: s, effects: [] };
      current = resolved.nextCellId;
      entryVia = resolved.jumped ? "jump" : "forward";
      continue;
    }

    if (isProducer(cell)) {
      if (entryVia === "back") {
        return { state: { ...s, status: "awaitingInput" }, effects: [] };
      }
      const run = s.cellRuns[cell.id];
      const skip = s.mode === "flow" && entryVia === "forward" && run?.status === "completed";
      if (skip) {
        current = nextCellId(s.cells, current);
        entryVia = "forward";
        continue;
      }
      const started = startProducer(s, cell.id);
      if (started.state.cellRuns[cell.id]?.status === "error") {
        // Synchronous validation failure (bad inline command payload).
        return afterCellFailure(started.state, cell.id);
      }
      return started;
    }

    return fatal(s, `cell ${current} of type ${cell.type} is not executable`);
  }
}

/** Mode-specific continuation after a per-cell failure was recorded. */
export function afterCellFailure(state: RunnerState, cellId: string): TransitionResult {
  const cleared: RunnerState = { ...state, inFlight: null, progress: null };
  if (cleared.mode === "flow") {
    return {
      state: {
        ...cleared,
        status: "pausedError",
        runAllActive: false,
        stopRequested: false,
        position: { ...cleared.position, cellId, enteredVia: cleared.position.enteredVia },
      },
      effects: [],
    };
  }
  if (cleared.runAllActive) {
    // Notebook passes record the error and keep going (web parity).
    return landOn(cleared, nextCellId(cleared.cells, cellId), "forward");
  }
  return { state: { ...cleared, status: "idle" }, effects: [] };
}
