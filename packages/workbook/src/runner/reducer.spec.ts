import { describe, expect, it } from "vitest";

import type { RunnerCell } from "../cells";
import {
  branchCell,
  commandCell as cmd,
  macroCell as macro,
  markdownCell as md,
  protocolCell as proto,
  questionCell as question,
} from "../demo/fixtures";
import type { Effect } from "./effects";
import type { WorkbookEvent } from "./events";
import { transition } from "./reducer";
import type { CreateStateOptions, RunnerState } from "./state";
import { createInitialState } from "./state";

const TIMINGS = { startedAt: 0, endedAt: 5 };

function init(cells: RunnerCell[], opts: Partial<CreateStateOptions> = {}): RunnerState {
  return createInitialState({ cells, ...opts });
}

interface Step {
  state: RunnerState;
  effects: Effect[];
}

function apply(state: RunnerState, ...events: WorkbookEvent[]): Step {
  let step: Step = { state, effects: [] };
  for (const event of events) {
    step = transition(step.state, event);
  }
  return step;
}

/** The completion event for the in-flight effect (command or macro). */
function doneEvent(state: RunnerState, output: unknown): WorkbookEvent {
  const inFlight = state.inFlight;
  if (!inFlight) throw new Error("nothing in flight");
  const base = { effectId: inFlight.effectId, cellId: inFlight.cellId, timings: TIMINGS };
  return inFlight.kind === "runMacro"
    ? { type: "MACRO_DONE", ...base, output: output as Record<string, unknown> }
    : { type: "COMMAND_DONE", ...base, output };
}

/** Complete the in-flight effect with `output`. */
function finish(state: RunnerState, output: unknown): Step {
  return transition(state, doneEvent(state, output));
}

function failCommand(state: RunnerState, error: string): Step {
  return transition(state, {
    type: "COMMAND_FAILED",
    effectId: state.inFlight?.effectId ?? "",
    cellId: state.inFlight?.cellId ?? "",
    error,
    timings: TIMINGS,
  });
}

/** A COMMAND_DONE for a given effect id, regardless of what is in flight. */
function commandDone(state: RunnerState, effectId: string, cellId: string, output: unknown): Step {
  return transition(state, { type: "COMMAND_DONE", effectId, cellId, output, timings: TIMINGS });
}

function resolveCode(state: RunnerState, code: Record<string, unknown>[] | null): Step {
  return transition(state, {
    type: "CODE_RESOLVED",
    effectId: state.inFlight?.effectId ?? "",
    cellId: state.inFlight?.cellId ?? "",
    code,
    timings: TIMINGS,
  });
}

function withoutTrace(state: RunnerState): Omit<RunnerState, "trace"> {
  const { trace: _trace, ...rest } = state;
  return rest;
}

const artifact = (content: string, extra: Record<string, unknown> = {}) => ({
  __ojArtifact: "command",
  version: 1,
  content,
  ...extra,
});

const answer = (value: string, cellId = "q1"): WorkbookEvent => ({
  type: "ANSWER",
  cellId,
  value,
});

/** Single-path branch on `source.answer eq value` jumping to `goto`. */
const branch = (id: string, pathId: string, goto: string, source = "q1", value = "yes") =>
  branchCell(id, [
    { id: pathId, goto, condition: { source, field: "answer", operator: "eq", value } },
  ]);

describe("transition: event/status matrix", () => {
  const noop = (types: readonly WorkbookEvent["type"][]): WorkbookEvent[] =>
    types.map((type) => ({ type }) as WorkbookEvent);

  /** Every event must be a pure no-op on `state` (trace excepted). */
  function expectIgnored(state: RunnerState, events: WorkbookEvent[]) {
    for (const event of events) {
      const next = transition(state, event);
      expect(next.effects).toEqual([]);
      expect(withoutTrace(next.state)).toEqual(withoutTrace(state));
    }
  }

  it("unaccepted events are no-ops that only touch the trace (never queued)", () => {
    const idle = init([md("m1"), question("q1", "Q One"), cmd("c1")]);
    expectIgnored(
      idle,
      noop(["NEXT", "BACK", "RETRY", "CANCEL", "STOP", "RUN_ALL", "START_CYCLE"]),
    );
    // While running, navigation and run events are ignored too.
    const running = apply(init([cmd("c1"), md("m1")]), { type: "START" });
    expect(running.state.status).toBe("running");
    expectIgnored(running.state, [
      ...noop(["NEXT", "BACK", "RETRY"]),
      { type: "RUN_CELL", cellId: "m1" },
    ]);
  });

  it("internal events with a stale effectId are dropped", () => {
    const step = apply(init([cmd("c1")]), { type: "START" });
    const bogus = commandDone(step.state, "e999", "c1", { phantom: true });
    expect(bogus.state.outputs).toEqual({});
    expect(bogus.state.status).toBe("running");
  });

  it("unknown cell types are skipped (old-app tolerance); fatal state ignores everything", () => {
    const step = apply(init([{ id: "x", type: "mystery" } as unknown as RunnerCell, md("m1")]), {
      type: "START",
    });
    expect(step.state.status).toBe("awaitingInput");
    expect(step.state.position.cellId).toBe("m1");
    const corrupted: RunnerState = { ...init([md("m1")]), status: "fatal", fatalReason: "test" };
    const after = transition(corrupted, { type: "RESET" });
    expect(after.state.status).toBe("fatal");
    expect(after.effects).toEqual([]);
  });
});

describe("transition: flow basics", () => {
  it("START enters the first cell, NEXT walks markdown, ANSWER advances only on target", () => {
    let step = apply(init([md("m1"), question("q1", "Q One"), question("q2", "Q Two")]), {
      type: "START",
    });
    expect(step.state.status).toBe("awaitingInput");
    expect(step.state.position.cellId).toBe("m1");
    expect(step.state.position.atStart).toBe(true);
    step = apply(step.state, { type: "NEXT" });
    expect(step.state.position.cellId).toBe("q1");
    // Off-target answers record without moving the cursor (mode-free rule).
    const offTarget = apply(step.state, answer("later", "q2"));
    expect(offTarget.state.position.cellId).toBe("q1");
    expect(offTarget.state.answersByCycle[0]).toEqual({ q2: "later" });
    // Answering a non-question id is fully ignored.
    const bogus = apply(step.state, answer("x", "nope"));
    expect(bogus.state.answersByCycle[0]).toEqual({});
    const onTarget = apply(step.state, answer("yes"));
    expect(onTarget.state.answersByCycle[0]).toEqual({ q1: "yes" });
    expect(onTarget.state.position.cellId).toBe("q2");
  });

  it("blank answers: required questions reject and block NEXT, optional ones clear the key", () => {
    const step = apply(init([question("q1", "Q One", true), md("m1")]), { type: "START" });
    const blank = apply(step.state, answer("  "));
    expect(blank.state.position.cellId).toBe("q1");
    expect(blank.state.cellRuns.q1?.status).toBe("error");
    expect(apply(blank.state, { type: "NEXT" }).state.position.cellId).toBe("q1");
    const ok = apply(blank.state, answer("yes"));
    expect(ok.state.cellRuns.q1?.status).toBe("completed");
    expect(ok.state.position.cellId).toBe("m1");
    // A blank answer on an optional question deletes the stored key.
    const optional = apply(
      init([question("q1", "Q One"), md("m1")]),
      { type: "START" },
      answer("yes"),
      { type: "BACK" },
      answer(""),
    );
    expect(optional.state.answersByCycle[0]).toEqual({});
  });
});

describe("transition: producers and effects", () => {
  it("a command cell emits a runCommand effect and completes on COMMAND_DONE", () => {
    const step = apply(init([cmd("c1", "battery"), md("m1")]), { type: "START" });
    expect(step.state.status).toBe("running");
    expect(step.effects).toHaveLength(1);
    const effect = step.effects[0];
    if (effect.kind !== "runCommand") throw new Error("expected runCommand");
    expect(effect.input.command).toBe("battery");
    expect(effect.input.source).toEqual({ kind: "inlineCell", format: "string" });
    const done = finish(step.state, { level: 82 });
    expect(done.state.cellRuns.c1?.status).toBe("completed");
    expect(done.state.cellRuns.c1?.executionTimeMs).toBe(5);
    expect(done.state.position.cellId).toBe("m1");
    // A malformed inline command fails without emitting an effect.
    const bad = apply(init([cmd("c1", "{nope", "json"), md("m1")]), { type: "START" });
    expect(bad.effects).toEqual([]);
    expect(bad.state.status).toBe("pausedError");
    expect(bad.state.cellRuns.c1?.status).toBe("error");
    // Reaching the end without loop finishes the run.
    const solo = finish(apply(init([cmd("c1")]), { type: "START" }).state, { ok: 1 });
    expect(solo.state.status).toBe("done");
    expect(solo.state.outputs.c1).toEqual({ v: { ok: 1 } });
  });

  it("protocol cells chain code resolution into a command run", () => {
    const step = apply(init([proto("p1")]), { type: "START" });
    expect(step.effects[0]?.kind).toBe("resolveProtocolCode");
    const code = [{ _protocol_set_: [] }];
    const resolved = resolveCode(step.state, code);
    const run = resolved.effects[0];
    if (run.kind !== "runCommand") throw new Error("expected runCommand");
    expect(run.input.command).toBe(code);
    expect(run.input.source.kind).toBe("protocolCell");
    const done = finish(resolved.state, [{ sample: 1 }]);
    expect(done.state.status).toBe("done");
  });

  it("null protocol code fails the cell with the web message", () => {
    const step = apply(init([proto("p1")]), { type: "START" });
    const resolved = resolveCode(step.state, null);
    expect(resolved.state.status).toBe("pausedError");
    expect(resolved.state.cellRuns.p1?.error).toBe("Invalid or missing protocol code");
  });

  it("macros receive the verbatim upstream json and the ctx namespace", () => {
    let step = apply(
      init([question("q1", "Sun Light"), cmd("c1"), macro("a1")]),
      { type: "START" },
      answer("yes"),
    );
    const raw = { sample: [{ Phi2: 0.7 }], device_id: "d1" };
    step = finish(step.state, raw);
    const effect = step.effects[0];
    if (effect.kind !== "runMacro") throw new Error("expected runMacro");
    expect(effect.input.json).toBe(raw);
    expect(effect.input.ctx.ctx.sun_light).toEqual({ answer: "yes" });
    expect(effect.input.ctx.byId.q1).toEqual({ answer: "yes" });
    // ctx view of the command output is normalized (sample unwrap).
    expect(effect.input.ctx.ctx.c1).toEqual({ Phi2: 0.7 });
  });
});

describe("transition: macro artifacts", () => {
  const cells = [macro("a1"), md("m1")];

  it("a validated artifact dispatches through the synthetic step", () => {
    let step = apply(init(cells), { type: "START" });
    step = finish(step.state, artifact("battery"));
    const effect = step.effects[0];
    if (effect.kind !== "runCommand") throw new Error("expected dispatch runCommand");
    expect(effect.cellId).toBe("a1__dispatch");
    expect(effect.input.source).toEqual({
      kind: "artifact",
      artifact: "command",
      producedBy: "a1",
    });
    expect(effect.input.command).toBe("battery");
    const done = finish(step.state, "82%");
    expect(done.state.outputs.a1__dispatch).toEqual({ v: "82%" });
    expect(done.state.position.cellId).toBe("m1");
  });

  it("invalid artifacts fail the macro without dispatching", () => {
    const rejected: {
      output: Record<string, unknown>;
      opts?: Partial<CreateStateOptions>;
      err: RegExp;
    }[] = [
      { output: artifact("rm -rf /"), err: /Unknown MultispeQ command/ },
      { output: artifact("set_dac+1+128"), err: /allowDeviceWrites/ },
      {
        output: artifact("anything-goes", { family: "generic" }),
        opts: { deviceFamily: "multispeq" },
        err: /does not match device family/,
      },
    ];
    for (const { output, opts, err } of rejected) {
      let step = apply(init(cells, opts), { type: "START" });
      step = finish(step.state, output);
      expect(step.effects).toEqual([]);
      expect(step.state.status).toBe("pausedError");
      expect(step.state.cellRuns.a1?.error).toMatch(err);
    }
    // The dangerous writer goes through once allowDeviceWrites is set.
    let allowed = apply(init(cells, { allowDeviceWrites: true }), { type: "START" });
    allowed = finish(allowed.state, artifact("set_dac+1+128"));
    expect(allowed.effects[0]?.kind).toBe("runCommand");
  });
});

describe("transition: branches", () => {
  it.each([
    // A match jumps and records the matched path plus a visit.
    { name: "match jumps", goto: "m2", answer: "yes", pos: "m2", landing: "m2", matched: "p1" },
    // No match falls through sequentially, still recording a return entry.
    { name: "no match falls through", goto: "m2", answer: "no", pos: "m1", landing: "m1" },
    // A matching path whose goto is the branch itself falls through.
    { name: "self-jump falls through", goto: "b1", answer: "yes", pos: "m1" },
  ])("branch routing: $name", ({ goto, answer, pos, landing, matched }) => {
    const cells = [question("q1", "Pick"), branch("b1", "p1", goto), md("m1"), md("m2")];
    const step = apply(
      init(cells),
      { type: "START" },
      { type: "ANSWER", cellId: "q1", value: answer },
    );
    expect(step.state.position.cellId).toBe(pos);
    if (landing) {
      expect(step.state.returnStack).toEqual([{ landingCellId: landing, returnToCellId: "q1" }]);
    }
    if (matched) {
      expect(step.state.cellRuns.b1?.lastMatchedPathId).toBe(matched);
      expect(step.state.branchVisits.b1).toBe(1);
    }
  });

  it("backward jumps re-run producers (loop-back means re-measure)", () => {
    const cells = [
      cmd("c1"),
      macro("a1"),
      branchCell("b1", [
        {
          id: "again",
          goto: "c1",
          condition: { source: "a1", field: "Phi2", operator: "lt", value: "0.5" },
        },
      ]),
      md("m_end"),
    ];
    let step = apply(init(cells), { type: "START" });
    step = finish(step.state, { raw: 1 });
    step = finish(step.state, { Phi2: 0.4 });
    // Branch looped back; the command must be running again despite completed.
    expect(step.state.status).toBe("running");
    expect(step.state.inFlight?.cellId).toBe("c1");
    step = finish(step.state, { raw: 2 });
    // Fresh command output marks the macro stale, so it re-runs on pass-through.
    step = finish(step.state, { Phi2: 0.8 });
    expect(step.state.position.cellId).toBe("m_end");
    expect(step.state.branchVisits.b1).toBe(2);
    expect(step.state.cellRuns.a1?.executionOrder).toHaveLength(2);
  });

  it("the visit cap routes exactly maxBranchVisits times then falls through", () => {
    const cells = [
      question("q1", "Pick"),
      md("m1"),
      branch("b1", "loop", "m1", "q1", "go"),
      md("m2"),
    ];
    let step = apply(init(cells, { maxBranchVisits: 3 }), { type: "START" }, answer("go"));
    // The answer advances to m1 first; each NEXT then routes through the branch.
    expect(step.state.position.cellId).toBe("m1");
    let routed = 0;
    for (let i = 0; i < 10 && step.state.position.cellId === "m1"; i++) {
      step = apply(step.state, { type: "NEXT" });
      if (step.state.position.cellId === "m1") routed += 1;
    }
    expect(routed).toBe(3);
    expect(step.state.position.cellId).toBe("m2");
  });
});

describe("transition: back navigation", () => {
  it("BACK pops the return stack, never lands on a branch, and no-ops at the start", () => {
    const cells = [question("q1", "Pick"), branch("b1", "p1", "m2"), cmd("c1"), md("m2")];
    let step = apply(init(cells), { type: "START" });
    const atStart = apply(step.state, { type: "BACK" });
    expect(atStart.state.position.cellId).toBe("q1");
    expect(atStart.state.position.atStart).toBe(true);
    step = apply(step.state, answer("yes"));
    expect(step.state.position.cellId).toBe("m2");
    step = apply(step.state, { type: "BACK" });
    expect(step.state.position.cellId).toBe("q1");
    expect(step.state.position.enteredVia).toBe("back");
    expect(step.state.returnStack).toEqual([]);
  });

  it("BACK discards nothing; re-entry skips completed producers and re-runs stale ones", () => {
    let step = apply(
      init([question("q1", "Pick"), cmd("c1"), md("m1")]),
      { type: "START" },
      answer("yes"),
    );
    step = finish(step.state, { ok: 1 });
    expect(step.state.position.cellId).toBe("m1");
    step = apply(step.state, { type: "BACK" });
    expect(step.state.position.cellId).toBe("c1");
    expect(step.state.outputs.c1).toEqual({ v: { ok: 1 } });
    step = apply(step.state, { type: "BACK" });
    expect(step.state.position.cellId).toBe("q1");
    expect(step.state.answersByCycle[0]).toEqual({ q1: "yes" });
    // Same answer: nothing stale, command passes through on the walk forward.
    const same = apply(step.state, answer("yes"));
    expect(same.state.position.cellId).toBe("m1");
    expect(same.state.cellRuns.c1?.executionOrder).toHaveLength(1);
    // A changed answer marks downstream stale and forces the re-run.
    const changed = apply(step.state, answer("no"));
    expect(changed.state.status).toBe("running");
    expect(changed.state.inFlight?.cellId).toBe("c1");
    const rerun = finish(changed.state, { ok: 2 });
    expect(rerun.state.outputs.c1).toEqual({ v: { ok: 2 } });
    expect(rerun.state.cellRuns.c1?.executionOrder).toHaveLength(2);
  });
});

describe("transition: cycles", () => {
  /** Run the [q1, c1] flow to its end once. */
  const ranOnce = (opts: Partial<CreateStateOptions> = {}) =>
    finish(
      apply(init([question("q1", "Pick"), cmd("c1")], opts), { type: "START" }, answer("yes"))
        .state,
      { ok: 1 },
    );

  it("loop mode wraps: answers and runs reset, outputs survive", () => {
    let step = ranOnce({ loop: true });
    expect(step.state.cycle).toBe(1);
    expect(step.state.position.cellId).toBe("q1");
    expect(step.state.answersByCycle[1]).toEqual({});
    expect(step.state.answersByCycle[0]).toEqual({ q1: "yes" });
    expect(step.state.outputs.c1).toEqual({ v: { ok: 1 } });
    expect(step.state.cellRuns).toEqual({});
    // Cycle 1 runs the command again (fresh run records).
    step = apply(step.state, answer("no"));
    expect(step.state.inFlight?.cellId).toBe("c1");
  });

  it("branch visit caps reset on wrap", () => {
    const cells = [question("q1", "Pick"), branch("b1", "p1", "m2"), md("m2")];
    let step = apply(
      init(cells, { loop: true, maxBranchVisits: 1 }),
      { type: "START" },
      answer("yes"),
    );
    expect(step.state.branchVisits.b1).toBe(1);
    step = apply(step.state, { type: "NEXT" });
    expect(step.state.cycle).toBe(1);
    expect(step.state.branchVisits).toEqual({});
    step = apply(step.state, answer("yes"));
    expect(step.state.position.cellId).toBe("m2");
  });

  it("START_CYCLE wraps explicitly and clears outputs", () => {
    let step = ranOnce();
    expect(step.state.status).toBe("done");
    step = apply(step.state, { type: "START_CYCLE" });
    expect(step.state.cycle).toBe(1);
    expect(step.state.outputs).toEqual({});
    expect(step.state.position.cellId).toBe("q1");
  });
});

describe("transition: cancellation and errors", () => {
  it("CANCEL discards the in-flight command and re-arms the cell", () => {
    let step = apply(init([cmd("c1"), md("m1")]), { type: "START" });
    const effectId = step.state.inFlight?.effectId ?? "";
    step = apply(step.state, { type: "CANCEL" });
    expect(step.state.status).toBe("cancelling");
    expect(step.effects).toEqual([{ kind: "cancelEffects", effectIds: [effectId] }]);
    // A completion arriving while cancelling is folded into the cancel.
    const folded = commandDone(step.state, effectId, "c1", { phantom: true });
    expect(folded.state.outputs).toEqual({});
    expect(folded.state.cellRuns.c1?.status).toBe("cancelled");
    step = apply(step.state, { type: "EFFECT_CANCELLED", effectId, cellId: "c1" });
    expect(step.state.status).toBe("awaitingInput");
    expect(step.state.cellRuns.c1?.status).toBe("cancelled");
    // The late device result must never record.
    const late = commandDone(step.state, effectId, "c1", { phantom: true });
    expect(late.state.outputs).toEqual({});
    // RETRY re-runs it cleanly.
    const retried = apply(late.state, { type: "RETRY" });
    expect(retried.state.inFlight?.cellId).toBe("c1");
    const done = finish(retried.state, { ok: 1 });
    expect(done.state.outputs.c1).toEqual({ v: { ok: 1 } });
  });

  it("failures pause, RETRY re-issues, CANCEL re-arms; RESET keeps minting effect ids", () => {
    const started = apply(init([cmd("c1"), md("m1")]), { type: "START" });
    const step = failCommand(started.state, "Command timeout");
    expect(step.state.status).toBe("pausedError");
    expect(step.state.cellRuns.c1?.error).toBe("Command timeout");
    const rearmed = apply(step.state, { type: "CANCEL" });
    expect(rearmed.state.status).toBe("awaitingInput");
    expect(rearmed.state.cellRuns.c1).toBeUndefined();
    const retried = apply(step.state, { type: "RETRY" });
    expect(retried.state.inFlight?.cellId).toBe("c1");
    // RESET returns to the initial state without resetting the effect counter.
    const reset = apply(started.state, { type: "RESET" });
    expect(reset.effects[0]?.kind).toBe("cancelEffects");
    expect(reset.state.status).toBe("idle");
    expect(reset.state.effectSeq).toBe(started.state.effectSeq);
  });
});

describe("transition: notebook mode", () => {
  const cells = [cmd("cA"), macro("aB"), cmd("cC"), md("m1")];

  function runAllToEnd(state: RunnerState): RunnerState {
    let step = apply(state, { type: "RUN_ALL" });
    while (step.state.inFlight) {
      const output = step.state.inFlight.kind === "runMacro" ? { Phi2: 0.7 } : { ok: true };
      step = finish(step.state, output);
    }
    return step.state;
  }

  it("RUN_ALL passes over every cell and stamps execution order; CLEAR_OUTPUTS wipes it all", () => {
    const state = runAllToEnd(init(cells, { mode: "notebook" }));
    expect(state.status).toBe("idle");
    expect(state.runAllActive).toBe(false);
    expect(state.cellRuns.cA?.executionOrder).toEqual([1]);
    expect(state.cellRuns.aB?.executionOrder).toEqual([2]);
    expect(state.cellRuns.cC?.executionOrder).toEqual([3]);
    const cleared = apply(state, { type: "CLEAR_OUTPUTS" });
    expect(cleared.state.outputs).toEqual({});
    expect(cleared.state.cellRuns).toEqual({});
    expect(cleared.state.execCounter).toBe(0);
  });

  it("re-running an upstream producer marks later completed producers stale", () => {
    let state = runAllToEnd(init(cells, { mode: "notebook" }));
    let step = apply(state, { type: "RUN_CELL", cellId: "cA" });
    step = finish(step.state, { ok: 2 });
    state = step.state;
    expect(state.cellRuns.cA?.status).toBe("completed");
    expect(state.cellRuns.aB?.status).toBe("stale");
    expect(state.cellRuns.cC?.status).toBe("stale");
    expect(state.outputs.aB).toBeDefined();
    // Re-running the macro clears its stale flag but leaves cC stale.
    step = apply(state, { type: "RUN_CELL", cellId: "aB" });
    step = finish(step.state, { Phi2: 0.9 });
    expect(step.state.cellRuns.aB?.status).toBe("completed");
    expect(step.state.cellRuns.cC?.status).toBe("stale");
  });

  it("a failing cell does not stop a RUN_ALL pass, but STOP ends it between cells", () => {
    const started = apply(init(cells, { mode: "notebook" }), { type: "RUN_ALL" });
    const failed = failCommand(started.state, "boom");
    // The pass moved on to the macro.
    expect(failed.state.cellRuns.cA?.status).toBe("error");
    expect(failed.state.inFlight?.cellId).toBe("aB");
    const stopped = finish(apply(started.state, { type: "STOP" }).state, { ok: 1 });
    expect(stopped.state.status).toBe("idle");
    expect(stopped.state.runAllActive).toBe(false);
    expect(stopped.state.cellRuns.aB).toBeUndefined();
  });

  it("a suspended pass resumes on the awaited answer; off-position answers do not disturb it", () => {
    const withQuestions = [question("q0", "Zero"), cmd("cA"), question("q1", "Pick"), cmd("cC")];
    let step = apply(
      init(withQuestions, { mode: "notebook" }),
      { type: "RUN_ALL" },
      answer("a", "q0"),
    );
    step = finish(step.state, { ok: 1 });
    expect(step.state.status).toBe("awaitingInput");
    expect(step.state.position.cellId).toBe("q1");
    step = apply(step.state, answer("b", "q0"));
    expect(step.state.status).toBe("awaitingInput");
    expect(step.state.runAllActive).toBe(true);
    expect(step.state.position.cellId).toBe("q1");
    step = apply(step.state, answer("yes"));
    expect(step.state.inFlight?.cellId).toBe("cC");
  });

  it("RUN_CELL on a markdown cell is a no-op in notebook mode", () => {
    const step = apply(init([md("m1"), cmd("cA")], { mode: "notebook" }), {
      type: "RUN_CELL",
      cellId: "m1",
    });
    expect(step.effects).toEqual([]);
    expect(step.state.status).toBe("idle");
    expect(step.state.inFlight).toBeNull();
  });
});

describe("transition: determinism", () => {
  it("the same event log replays to a deep-equal final state", () => {
    const cells = [question("q1", "Pick"), cmd("c1"), macro("a1"), md("m1")];
    const log: WorkbookEvent[] = [{ type: "START" }, answer("yes")];

    let live = apply(init(cells), ...log);
    for (const output of [{ raw: [1, 2] }, { Phi2: 0.7 }]) {
      const event = doneEvent(live.state, output);
      log.push(event);
      live = transition(live.state, event);
    }

    const replayed = apply(init(cells), ...log);
    expect(replayed.state).toEqual(live.state);
  });

  it("transition is pure: same result twice, input state untouched", () => {
    const before = apply(init([question("q1", "Pick"), cmd("c1")]), { type: "START" }).state;
    const frozen = JSON.parse(JSON.stringify(before)) as unknown;
    const event: WorkbookEvent = answer("yes");
    const a = transition(before, event);
    const b = transition(before, event);
    expect(a.state).toEqual(b.state);
    expect(a.effects).toEqual(b.effects);
    expect(JSON.parse(JSON.stringify(before))).toEqual(frozen);
  });
});
