import { assign, createActor, enqueueActions, fromPromise, setup } from "xstate";

import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";
import { evaluateBranch } from "@repo/api/utils/evaluate-branch";

import {
  DONE,
  ERROR,
  dispatchChildId,
  executableCells,
  hydrateCells,
  macroDispatchId,
  nearestUpstreamMeasurementId,
  nextStateId,
  resolveGotoStateId,
} from "./flow-utils";
import { getConstructedProtocol } from "./runtime";
import type { MacroInput, ProtocolInput, WorkbookRuntime } from "./runtime";

// Mirrors mobile's evaluate-and-route MAX_BRANCH_VISITS / web's MAX_VISITS_PER_CELL.
export const MAX_BRANCH_VISITS = 100;

// Runtime state the machine carries. This whole object is serializable, so it is
// the durable half of an XState persisted snapshot (see getPersistedSnapshot).
export interface WorkbookContext {
  cells: WorkbookCell[];
  answers: Record<string, string>; // keyed by question cell id
  outputs: Record<string, unknown>; // keyed by PRODUCER cell id (protocol/macro)
  visits: Record<string, number>; // branch cell id -> times entered (loop cap)
  trace: string[]; // human-readable step log for the demo
  error: string | null;
}

export interface WorkbookInput {
  cells: WorkbookCell[];
  answers?: Record<string, string>;
  outputs?: Record<string, unknown>;
}

export type WorkbookEvent =
  | { type: "NEXT" } // advance an instruction step
  | { type: "ANSWER"; cellId: string; value: string }; // answer a question step

/**
 * Turn a workbook (the persisted cell array, passed in as-is) into a dynamic
 * XState v5 machine that drives the measurement flow:
 *
 *   markdown -> state that waits for NEXT
 *   question -> state that waits for an ANSWER, recorded into context.answers
 *   protocol -> state that invokes runProtocol (device scan), result -> outputs
 *   macro    -> state that invokes runMacro (analysis), result -> outputs
 *   branch   -> eventless (always) guarded transitions; routing delegates to the
 *               production evaluateBranch over hydrated cells, with a loop cap
 *
 * The async side effects are injected (`runtime`) so the machine runs headless.
 */
export function buildWorkbookMachine(cells: WorkbookCell[], runtime: WorkbookRuntime) {
  const machine = setup({
    types: {
      context: {} as WorkbookContext,
      events: {} as WorkbookEvent,
      input: {} as WorkbookInput,
    },
    actors: {
      runProtocol: fromPromise(async ({ input }: { input: ProtocolInput }) =>
        runtime.runProtocol(input),
      ),
      runMacro: fromPromise(async ({ input }: { input: MacroInput }) => runtime.runMacro(input)),
    },
    actions: {
      trace: assign(({ context }, params: { line: string }) => ({
        trace: [...context.trace, params.line],
      })),
      recordAnswer: assign(({ context, event }) => {
        if (event.type !== "ANSWER") return {};
        return {
          answers: { ...context.answers, [event.cellId]: event.value },
          trace: [...context.trace, `answer ${event.cellId} = ${event.value}`],
        };
      }),
      recordOutput: assign(({ context, event }, params: { cellId: string; kind: string }) => {
        const output = "output" in event ? (event.output as Record<string, unknown>) : {};
        return {
          outputs: { ...context.outputs, [params.cellId]: output },
          trace: [...context.trace, `${params.kind} ${params.cellId} -> ${JSON.stringify(output)}`],
        };
      }),
      incrementVisit: assign(({ context }, params: { branchCellId: string }) => ({
        visits: {
          ...context.visits,
          [params.branchCellId]: (context.visits[params.branchCellId] ?? 0) + 1,
        },
      })),
      setError: assign(({ context, event }) => {
        const reason = "error" in event ? String(event.error) : "unknown error";
        return { error: reason, trace: [...context.trace, `error: ${reason}`] };
      }),
      // Dispatch as an explicit action: spawn the runProtocol actor on the
      // protocol the macro just constructed. Its result is awaited by the
      // companion dispatch state via the spawned child's done event.
      dispatchConstructedProtocol: enqueueActions(
        ({ context, event, enqueue }, params: { cellId: string }) => {
          const protocol = "output" in event ? getConstructedProtocol(event.output) : null;
          if (!protocol) return;
          enqueue.spawnChild("runProtocol", {
            id: dispatchChildId(params.cellId),
            input: {
              cellId: macroDispatchId(params.cellId),
              protocol,
              ctx: { answers: context.answers, outputs: context.outputs },
            },
          });
        },
      ),
    },
    guards: {
      // The ANSWER event must target this exact question, else it is ignored.
      eventCellIs: ({ event }, params: { cellId: string }) =>
        event.type === "ANSWER" && event.cellId === params.cellId,
      // Did the macro that just finished return a constructed protocol to
      // dispatch? Reads the done event's output (recordOutput has not run yet).
      macroProducedDispatch: ({ event }) =>
        "output" in event && getConstructedProtocol(event.output) !== null,
      // Reuses the production branch evaluator: does evaluateBranch pick a path
      // whose gotoCellId is this target? Loop cap stops runaway goto cycles.
      branchRoutesTo: (
        { context },
        params: { branchCellId: string; targetCellId: string; maxVisits: number },
      ) => {
        if ((context.visits[params.branchCellId] ?? 0) > params.maxVisits) return false;
        const branchCell = context.cells.find((c) => c.id === params.branchCellId);
        if (branchCell?.type !== "branch") return false;
        const hydrated = hydrateCells(context.cells, context.answers, context.outputs);
        const matched = evaluateBranch(branchCell, hydrated);
        return matched?.gotoCellId === params.targetCellId;
      },
    },
  }).createMachine({
    id: "workbook",
    context: ({ input }) => ({
      cells: input.cells,
      answers: input.answers ?? {},
      outputs: input.outputs ?? {},
      visits: {},
      trace: [],
      error: null,
    }),
    initial: executableCells(cells)[0]?.id ?? DONE,
    // Generated config: one state per executable cell. Typed loosely because it is
    // built from data, not a literal; all behaviour lives in the typed setup() above.
    // context stays strongly typed via setup({ types.context }).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    states: buildStates(cells) as any,
  });

  return machine;
}

/** Convenience: build the machine from a workbook and return a started actor. */
export function createWorkbookActor(
  cells: WorkbookCell[],
  runtime: WorkbookRuntime,
  input?: Omit<WorkbookInput, "cells">,
) {
  const machine = buildWorkbookMachine(cells, runtime);
  return createActor(machine, { input: { cells, ...input } });
}

// --- config generation -----------------------------------------------------

type StateConfig = Record<string, unknown>;

function buildStates(cells: WorkbookCell[]): Record<string, StateConfig> {
  const states: Record<string, StateConfig> = {};

  for (const cell of executableCells(cells)) {
    const next = nextStateId(cells, cell.id);
    states[cell.id] = stateForCell(cell, cells, next);
    // A macro may dispatch a protocol it constructed: generate the companion
    // state that runs it, then continues to where the macro would have gone.
    if (cell.type === "macro") {
      states[macroDispatchId(cell.id)] = macroDispatchState(cell.id, next);
    }
  }

  states[DONE] = { type: "final", entry: trace("flow complete") };
  states[ERROR] = { type: "final", entry: trace("flow errored") };
  return states;
}

function stateForCell(cell: WorkbookCell, cells: WorkbookCell[], next: string): StateConfig {
  switch (cell.type) {
    case "markdown":
      return {
        entry: trace(`instruction ${cell.id}`),
        on: { NEXT: { target: next } },
      };

    case "question":
      return {
        entry: trace(`question ${cell.id} (${cell.question.kind})`),
        on: {
          ANSWER: {
            guard: { type: "eventCellIs", params: { cellId: cell.id } },
            actions: "recordAnswer",
            target: next,
          },
        },
      };

    case "protocol":
      return {
        entry: trace(`measurement ${cell.id}`),
        invoke: {
          src: "runProtocol",
          input: ({ context }: { context: WorkbookContext }): ProtocolInput => ({
            cellId: cell.id,
            protocolId: cell.payload.protocolId,
            ctx: { answers: context.answers, outputs: context.outputs },
          }),
          onDone: {
            actions: { type: "recordOutput", params: { cellId: cell.id, kind: "measurement" } },
            target: next,
          },
          onError: { actions: "setError", target: ERROR },
        },
      };

    case "macro": {
      // A macro runs against the nearest upstream scan (its `json`) plus the ctx
      // namespace (answers + every prior output) - this is what makes a macro an
      // executor that "passes things" rather than an opaque step.
      const upstreamId = nearestUpstreamMeasurementId(cells, cell.id);
      return {
        entry: trace(`analysis ${cell.id}`),
        invoke: {
          src: "runMacro",
          input: ({ context }: { context: WorkbookContext }): MacroInput => ({
            cellId: cell.id,
            macroId: cell.payload.macroId,
            json: upstreamId
              ? ((context.outputs[upstreamId] as Record<string, unknown>) ?? null)
              : null,
            ctx: { answers: context.answers, outputs: context.outputs },
          }),
          // If the macro returned a constructed protocol, dispatch it (an explicit
          // action) and wait in the dispatch state; otherwise fall through to next.
          onDone: [
            {
              guard: "macroProducedDispatch",
              actions: [
                { type: "recordOutput", params: { cellId: cell.id, kind: "analysis" } },
                { type: "trace", params: { line: `dispatch ${cell.id}` } },
                { type: "dispatchConstructedProtocol", params: { cellId: cell.id } },
              ],
              target: macroDispatchId(cell.id),
            },
            {
              actions: { type: "recordOutput", params: { cellId: cell.id, kind: "analysis" } },
              target: next,
            },
          ],
          onError: { actions: "setError", target: ERROR },
        },
      };
    }

    case "branch":
      return branchState(cell, cells, next);

    default:
      // output cells are not executable and never reach here
      return { entry: trace(`skip ${cell.id}`), always: { target: next } };
  }
}

// A branch becomes eventless `always` transitions, one per distinct reachable
// goto target (in path order), each guarded by the production evaluator; the
// final unguarded transition is the sequential fall-through (default path /
// no match / loop cap). Self-jumps and unresolved gotos are dropped.
function branchState(
  cell: Extract<WorkbookCell, { type: "branch" }>,
  cells: WorkbookCell[],
  next: string,
): StateConfig {
  const transitions: StateConfig[] = [];
  const seen = new Set<string>();

  for (const path of cell.paths) {
    if (!path.gotoCellId) continue;
    const targetState = resolveGotoStateId(cells, path.gotoCellId);
    if (!targetState || targetState === cell.id || seen.has(targetState)) continue;
    seen.add(targetState);
    transitions.push({
      guard: {
        type: "branchRoutesTo",
        params: {
          branchCellId: cell.id,
          targetCellId: path.gotoCellId,
          maxVisits: MAX_BRANCH_VISITS,
        },
      },
      target: targetState,
    });
  }

  transitions.push({ target: next });

  return {
    entry: [
      trace(`branch ${cell.id}`),
      { type: "incrementVisit", params: { branchCellId: cell.id } },
    ],
    always: transitions,
  };
}

// Waits for the protocol the macro dispatched (spawned by the
// dispatchConstructedProtocol action) to finish, folds its result in, then
// continues to the macro's sequential next. The execution + @repo/iot
// validation happen in the spawned runProtocol actor.
function macroDispatchState(macroCellId: string, next: string): StateConfig {
  const childId = dispatchChildId(macroCellId);
  return {
    on: {
      [`xstate.done.actor.${childId}`]: {
        actions: {
          type: "recordOutput",
          params: { cellId: macroDispatchId(macroCellId), kind: "dispatch" },
        },
        target: next,
      },
      [`xstate.error.actor.${childId}`]: { actions: "setError", target: ERROR },
    },
  };
}

function trace(line: string): StateConfig {
  return { type: "trace", params: { line } };
}
