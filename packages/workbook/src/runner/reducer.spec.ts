import { describe, expect, it } from "vitest";

import type { RunnerCell } from "../cells";
import {
  branchCell as branch,
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

/** Complete the in-flight command effect with `output`. */
function finishCommand(state: RunnerState, output: unknown): Step {
  const inFlight = state.inFlight;
  if (!inFlight) throw new Error("nothing in flight");
  return transition(state, {
    type: "COMMAND_DONE",
    effectId: inFlight.effectId,
    cellId: inFlight.cellId,
    output,
    timings: TIMINGS,
  });
}

function finishMacro(state: RunnerState, output: Record<string, unknown>): Step {
  const inFlight = state.inFlight;
  if (!inFlight) throw new Error("nothing in flight");
  return transition(state, {
    type: "MACRO_DONE",
    effectId: inFlight.effectId,
    cellId: inFlight.cellId,
    output,
    timings: TIMINGS,
  });
}

function withoutTrace(state: RunnerState): Omit<RunnerState, "trace"> {
  const { trace: _trace, ...rest } = state;
  return rest;
}

describe("transition: event/status matrix", () => {
  it("unaccepted events are no-ops that only touch the trace", () => {
    const idle = init([md("m1"), question("q1", "Q One"), cmd("c1")]);
    const events: WorkbookEvent[] = [
      { type: "NEXT" },
      { type: "BACK" },
      { type: "RETRY" },
      { type: "CANCEL" },
      { type: "STOP" },
      { type: "RUN_ALL" },
      { type: "START_CYCLE" },
    ];
    for (const event of events) {
      const { state: next, effects } = transition(idle, event);
      expect(effects).toEqual([]);
      expect(withoutTrace(next)).toEqual(withoutTrace(idle));
    }
  });

  it("events sent while running are ignored (never queued)", () => {
    const step = apply(init([cmd("c1"), md("m1")]), { type: "START" });
    expect(step.state.status).toBe("running");
    for (const event of [
      { type: "NEXT" } as const,
      { type: "BACK" } as const,
      { type: "RUN_CELL", cellId: "m1" } as const,
      { type: "RETRY" } as const,
    ]) {
      const next = transition(step.state, event);
      expect(next.effects).toEqual([]);
      expect(withoutTrace(next.state)).toEqual(withoutTrace(step.state));
    }
  });

  it("internal events with a stale effectId are dropped", () => {
    const step = apply(init([cmd("c1")]), { type: "START" });
    const bogus = transition(step.state, {
      type: "COMMAND_DONE",
      effectId: "e999",
      cellId: "c1",
      output: { phantom: true },
      timings: TIMINGS,
    });
    expect(bogus.state.outputs).toEqual({});
    expect(bogus.state.status).toBe("running");
  });

  it("unknown cell types are skipped like output cells (old-app tolerance)", () => {
    const step = apply(init([{ id: "x", type: "mystery" } as unknown as RunnerCell, md("m1")]), {
      type: "START",
    });
    expect(step.state.status).toBe("awaitingInput");
    expect(step.state.position.cellId).toBe("m1");
  });

  it("fatal state ignores everything", () => {
    const corrupted: RunnerState = { ...init([md("m1")]), status: "fatal", fatalReason: "test" };
    const after = transition(corrupted, { type: "RESET" });
    expect(after.state.status).toBe("fatal");
    expect(after.effects).toEqual([]);
  });
});

describe("transition: flow basics", () => {
  it("START enters the first executable cell and NEXT walks markdown", () => {
    const step = apply(init([md("m1"), question("q1", "Q One")]), { type: "START" });
    expect(step.state.status).toBe("awaitingInput");
    expect(step.state.position.cellId).toBe("m1");
    expect(step.state.position.atStart).toBe(true);
    const next = apply(step.state, { type: "NEXT" });
    expect(next.state.position.cellId).toBe("q1");
  });

  it("ANSWER advances only when it targets the awaited cell", () => {
    const step = apply(init([question("q1", "Q One"), question("q2", "Q Two")]), {
      type: "START",
    });
    // Off-target answers record without moving the cursor (mode-free rule).
    const offTarget = apply(step.state, { type: "ANSWER", cellId: "q2", value: "later" });
    expect(offTarget.state.position.cellId).toBe("q1");
    expect(offTarget.state.answersByCycle[0]).toEqual({ q2: "later" });
    // Answering a non-question id is fully ignored.
    const bogus = apply(step.state, { type: "ANSWER", cellId: "nope", value: "x" });
    expect(bogus.state.answersByCycle[0]).toEqual({});
    const onTarget = apply(step.state, { type: "ANSWER", cellId: "q1", value: "yes" });
    expect(onTarget.state.answersByCycle[0]).toEqual({ q1: "yes" });
    expect(onTarget.state.position.cellId).toBe("q2");
  });

  it("required questions reject blank answers and block NEXT", () => {
    const step = apply(init([question("q1", "Q One", true), md("m1")]), { type: "START" });
    const blank = apply(step.state, { type: "ANSWER", cellId: "q1", value: "  " });
    expect(blank.state.position.cellId).toBe("q1");
    expect(blank.state.cellRuns.q1?.status).toBe("error");
    const blockedNext = apply(blank.state, { type: "NEXT" });
    expect(blockedNext.state.position.cellId).toBe("q1");
    const ok = apply(blank.state, { type: "ANSWER", cellId: "q1", value: "yes" });
    expect(ok.state.cellRuns.q1?.status).toBe("completed");
    expect(ok.state.position.cellId).toBe("m1");
  });

  it("blank answers on optional questions delete the stored key", () => {
    const s0 = apply(init([question("q1", "Q One"), md("m1")]), { type: "START" });
    const answered = apply(s0.state, { type: "ANSWER", cellId: "q1", value: "yes" });
    const back = apply(answered.state, { type: "BACK" });
    const cleared = apply(back.state, { type: "ANSWER", cellId: "q1", value: "" });
    expect(cleared.state.answersByCycle[0]).toEqual({});
  });

  it("reaching the end without loop finishes the run", () => {
    let step = apply(init([cmd("c1")]), { type: "START" });
    step = finishCommand(step.state, { ok: 1 });
    expect(step.state.status).toBe("done");
    expect(step.state.outputs.c1).toEqual({ v: { ok: 1 } });
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
    const done = finishCommand(step.state, { level: 82 });
    expect(done.state.cellRuns.c1?.status).toBe("completed");
    expect(done.state.cellRuns.c1?.executionTimeMs).toBe(5);
    expect(done.state.position.cellId).toBe("m1");
  });

  it("a malformed inline command fails without emitting an effect", () => {
    const bad = cmd("c1", "{nope", "json");
    const step = apply(init([bad, md("m1")]), { type: "START" });
    expect(step.effects).toEqual([]);
    expect(step.state.status).toBe("pausedError");
    expect(step.state.cellRuns.c1?.status).toBe("error");
  });

  it("protocol cells chain code resolution into a command run", () => {
    const step = apply(init([proto("p1")]), { type: "START" });
    const resolve = step.effects[0];
    if (resolve.kind !== "resolveProtocolCode") throw new Error("expected resolve effect");
    const code = [{ _protocol_set_: [] }];
    const resolved = transition(step.state, {
      type: "CODE_RESOLVED",
      effectId: resolve.effectId,
      cellId: "p1",
      code,
      timings: TIMINGS,
    });
    const run = resolved.effects[0];
    if (run.kind !== "runCommand") throw new Error("expected runCommand");
    expect(run.input.command).toBe(code);
    expect(run.input.source.kind).toBe("protocolCell");
    const done = finishCommand(resolved.state, [{ sample: 1 }]);
    expect(done.state.status).toBe("done");
  });

  it("null protocol code fails the cell with the web message", () => {
    const step = apply(init([proto("p1")]), { type: "START" });
    const resolved = transition(step.state, {
      type: "CODE_RESOLVED",
      effectId: step.state.inFlight?.effectId ?? "",
      cellId: "p1",
      code: null,
      timings: TIMINGS,
    });
    expect(resolved.state.status).toBe("pausedError");
    expect(resolved.state.cellRuns.p1?.error).toBe("Invalid or missing protocol code");
  });

  it("macros receive the verbatim upstream json and the ctx namespace", () => {
    let step = apply(init([question("q1", "Sun Light"), cmd("c1"), macro("a1")]), {
      type: "START",
    });
    step = apply(step.state, { type: "ANSWER", cellId: "q1", value: "yes" });
    const raw = { sample: [{ Phi2: 0.7 }], device_id: "d1" };
    step = finishCommand(step.state, raw);
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
    step = finishMacro(step.state, { __ojArtifact: "command", version: 1, content: "battery" });
    const effect = step.effects[0];
    if (effect.kind !== "runCommand") throw new Error("expected dispatch runCommand");
    expect(effect.cellId).toBe("a1__dispatch");
    expect(effect.input.source).toEqual({
      kind: "artifact",
      artifact: "command",
      producedBy: "a1",
    });
    expect(effect.input.command).toBe("battery");
    const done = finishCommand(step.state, "82%");
    expect(done.state.outputs.a1__dispatch).toEqual({ v: "82%" });
    expect(done.state.position.cellId).toBe("m1");
  });

  it("a forged command is rejected by the validator and fails the macro", () => {
    let step = apply(init(cells), { type: "START" });
    step = finishMacro(step.state, { __ojArtifact: "command", version: 1, content: "rm -rf /" });
    expect(step.effects).toEqual([]);
    expect(step.state.status).toBe("pausedError");
    expect(step.state.cellRuns.a1?.error).toMatch(/Unknown MultispeQ command/);
  });

  it("dangerous writers require allowDeviceWrites", () => {
    let step = apply(init(cells), { type: "START" });
    step = finishMacro(step.state, {
      __ojArtifact: "command",
      version: 1,
      content: "set_dac+1+128",
    });
    expect(step.state.cellRuns.a1?.error).toMatch(/allowDeviceWrites/);

    let allowed = apply(init(cells, { allowDeviceWrites: true }), { type: "START" });
    allowed = finishMacro(allowed.state, {
      __ojArtifact: "command",
      version: 1,
      content: "set_dac+1+128",
    });
    expect(allowed.effects[0]?.kind).toBe("runCommand");
  });

  it("an artifact family contradicting the host device family is rejected", () => {
    let step = apply(init(cells, { deviceFamily: "multispeq" }), { type: "START" });
    step = finishMacro(step.state, {
      __ojArtifact: "command",
      version: 1,
      family: "generic",
      content: "anything-goes",
    });
    expect(step.state.cellRuns.a1?.error).toMatch(/does not match device family/);
  });
});

describe("transition: branches", () => {
  it("first matching path jumps and records the return stack", () => {
    const cells = [
      question("q1", "Pick"),
      branch("b1", [
        {
          id: "p1",
          goto: "m2",
          condition: { source: "q1", field: "answer", operator: "eq", value: "yes" },
        },
      ]),
      md("m1"),
      md("m2"),
    ];
    let step = apply(init(cells), { type: "START" });
    step = apply(step.state, { type: "ANSWER", cellId: "q1", value: "yes" });
    expect(step.state.position.cellId).toBe("m2");
    expect(step.state.cellRuns.b1?.lastMatchedPathId).toBe("p1");
    expect(step.state.returnStack).toEqual([{ landingCellId: "m2", returnToCellId: "q1" }]);
    expect(step.state.branchVisits.b1).toBe(1);
  });

  it("no match falls through sequentially and still records a return entry", () => {
    const cells = [
      question("q1", "Pick"),
      branch("b1", [
        {
          id: "p1",
          goto: "m2",
          condition: { source: "q1", field: "answer", operator: "eq", value: "yes" },
        },
      ]),
      md("m1"),
      md("m2"),
    ];
    let step = apply(init(cells), { type: "START" });
    step = apply(step.state, { type: "ANSWER", cellId: "q1", value: "no" });
    expect(step.state.position.cellId).toBe("m1");
    expect(step.state.returnStack).toEqual([{ landingCellId: "m1", returnToCellId: "q1" }]);
  });

  it("self-jumps and gotos to non-executable cells fall through", () => {
    const cells = [
      question("q1", "Pick"),
      branch("b1", [
        {
          id: "self",
          goto: "b1",
          condition: { source: "q1", field: "answer", operator: "eq", value: "yes" },
        },
      ]),
      md("m1"),
    ];
    let step = apply(init(cells), { type: "START" });
    step = apply(step.state, { type: "ANSWER", cellId: "q1", value: "yes" });
    expect(step.state.position.cellId).toBe("m1");
  });

  it("backward jumps re-run producers (loop-back means re-measure)", () => {
    const cells = [
      cmd("c1"),
      macro("a1"),
      branch("b1", [
        {
          id: "again",
          goto: "c1",
          condition: { source: "a1", field: "Phi2", operator: "lt", value: "0.5" },
        },
      ]),
      md("m_end"),
    ];
    let step = apply(init(cells), { type: "START" });
    step = finishCommand(step.state, { raw: 1 });
    step = finishMacro(step.state, { Phi2: 0.4 });
    // Branch looped back; the command must be running again despite completed.
    expect(step.state.status).toBe("running");
    expect(step.state.inFlight?.cellId).toBe("c1");
    step = finishCommand(step.state, { raw: 2 });
    // Fresh command output marks the macro stale, so it re-runs on pass-through.
    step = finishMacro(step.state, { Phi2: 0.8 });
    expect(step.state.position.cellId).toBe("m_end");
    expect(step.state.branchVisits.b1).toBe(2);
    expect(step.state.cellRuns.a1?.executionOrder).toHaveLength(2);
  });

  it("the visit cap routes exactly maxBranchVisits times then falls through", () => {
    const cells = [
      question("q1", "Pick"),
      md("m1"),
      branch("b1", [
        {
          id: "loop",
          goto: "m1",
          condition: { source: "q1", field: "answer", operator: "eq", value: "go" },
        },
      ]),
      md("m2"),
    ];
    let step = apply(init(cells, { maxBranchVisits: 3 }), { type: "START" });
    step = apply(step.state, { type: "ANSWER", cellId: "q1", value: "go" });
    // Landed on m1 via the first branch? No: answer advances to m1 first.
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
  const cells = [
    question("q1", "Pick"),
    branch("b1", [
      {
        id: "p1",
        goto: "m2",
        condition: { source: "q1", field: "answer", operator: "eq", value: "yes" },
      },
    ]),
    cmd("c1"),
    md("m2"),
  ];

  it("BACK pops the return stack and never lands on a branch", () => {
    let step = apply(init(cells), { type: "START" });
    step = apply(step.state, { type: "ANSWER", cellId: "q1", value: "yes" });
    expect(step.state.position.cellId).toBe("m2");
    step = apply(step.state, { type: "BACK" });
    expect(step.state.position.cellId).toBe("q1");
    expect(step.state.position.enteredVia).toBe("back");
    expect(step.state.returnStack).toEqual([]);
  });

  it("BACK discards nothing and forward re-entry skips completed producers", () => {
    let step = apply(init([question("q1", "Pick"), cmd("c1"), md("m1")]), { type: "START" });
    step = apply(step.state, { type: "ANSWER", cellId: "q1", value: "yes" });
    step = finishCommand(step.state, { ok: 1 });
    expect(step.state.position.cellId).toBe("m1");
    step = apply(step.state, { type: "BACK" });
    expect(step.state.position.cellId).toBe("c1");
    expect(step.state.outputs.c1).toEqual({ v: { ok: 1 } });
    step = apply(step.state, { type: "BACK" });
    expect(step.state.position.cellId).toBe("q1");
    expect(step.state.answersByCycle[0]).toEqual({ q1: "yes" });
    // Same answer: nothing stale, command passes through on the walk forward.
    step = apply(step.state, { type: "ANSWER", cellId: "q1", value: "yes" });
    expect(step.state.position.cellId).toBe("m1");
    expect(step.state.cellRuns.c1?.executionOrder).toHaveLength(1);
  });

  it("a changed answer marks downstream stale and forces the re-run", () => {
    let step = apply(init([question("q1", "Pick"), cmd("c1"), md("m1")]), { type: "START" });
    step = apply(step.state, { type: "ANSWER", cellId: "q1", value: "yes" });
    step = finishCommand(step.state, { ok: 1 });
    step = apply(step.state, { type: "BACK" }, { type: "BACK" });
    step = apply(step.state, { type: "ANSWER", cellId: "q1", value: "no" });
    // Stale command re-runs instead of passing through.
    expect(step.state.status).toBe("running");
    expect(step.state.inFlight?.cellId).toBe("c1");
    step = finishCommand(step.state, { ok: 2 });
    expect(step.state.outputs.c1).toEqual({ v: { ok: 2 } });
    expect(step.state.cellRuns.c1?.executionOrder).toHaveLength(2);
  });

  it("BACK at the first cell is a no-op that surfaces atStart", () => {
    const step = apply(init(cells), { type: "START" });
    const back = apply(step.state, { type: "BACK" });
    expect(back.state.position.cellId).toBe("q1");
    expect(back.state.position.atStart).toBe(true);
  });
});

describe("transition: cycles", () => {
  it("loop mode wraps: answers and runs reset, outputs survive", () => {
    let step = apply(init([question("q1", "Pick"), cmd("c1")], { loop: true }), { type: "START" });
    step = apply(step.state, { type: "ANSWER", cellId: "q1", value: "yes" });
    step = finishCommand(step.state, { ok: 1 });
    expect(step.state.cycle).toBe(1);
    expect(step.state.position.cellId).toBe("q1");
    expect(step.state.answersByCycle[1]).toEqual({});
    expect(step.state.answersByCycle[0]).toEqual({ q1: "yes" });
    expect(step.state.outputs.c1).toEqual({ v: { ok: 1 } });
    expect(step.state.cellRuns).toEqual({});
    // Cycle 1 runs the command again (fresh run records).
    step = apply(step.state, { type: "ANSWER", cellId: "q1", value: "no" });
    expect(step.state.inFlight?.cellId).toBe("c1");
  });

  it("branch visit caps reset on wrap", () => {
    const cells = [
      question("q1", "Pick"),
      branch("b1", [
        {
          id: "p1",
          goto: "m2",
          condition: { source: "q1", field: "answer", operator: "eq", value: "yes" },
        },
      ]),
      md("m2"),
    ];
    let step = apply(init(cells, { loop: true, maxBranchVisits: 1 }), { type: "START" });
    step = apply(step.state, { type: "ANSWER", cellId: "q1", value: "yes" });
    expect(step.state.branchVisits.b1).toBe(1);
    step = apply(step.state, { type: "NEXT" });
    expect(step.state.cycle).toBe(1);
    expect(step.state.branchVisits).toEqual({});
    step = apply(step.state, { type: "ANSWER", cellId: "q1", value: "yes" });
    expect(step.state.position.cellId).toBe("m2");
  });

  it("START_CYCLE wraps explicitly and clears outputs", () => {
    let step = apply(init([question("q1", "Pick"), cmd("c1")]), { type: "START" });
    step = apply(step.state, { type: "ANSWER", cellId: "q1", value: "yes" });
    step = finishCommand(step.state, { ok: 1 });
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
    step = apply(step.state, { type: "EFFECT_CANCELLED", effectId, cellId: "c1" });
    expect(step.state.status).toBe("awaitingInput");
    expect(step.state.cellRuns.c1?.status).toBe("cancelled");
    // The late device result must never record.
    const late = transition(step.state, {
      type: "COMMAND_DONE",
      effectId,
      cellId: "c1",
      output: { phantom: true },
      timings: TIMINGS,
    });
    expect(late.state.outputs).toEqual({});
    // RETRY re-runs it cleanly.
    const retried = apply(late.state, { type: "RETRY" });
    expect(retried.state.inFlight?.cellId).toBe("c1");
    const done = finishCommand(retried.state, { ok: 1 });
    expect(done.state.outputs.c1).toEqual({ v: { ok: 1 } });
  });

  it("a completion arriving while cancelling is folded into the cancel", () => {
    let step = apply(init([cmd("c1")]), { type: "START" });
    const effectId = step.state.inFlight?.effectId ?? "";
    step = apply(step.state, { type: "CANCEL" });
    step = transition(step.state, {
      type: "COMMAND_DONE",
      effectId,
      cellId: "c1",
      output: { phantom: true },
      timings: TIMINGS,
    });
    expect(step.state.outputs).toEqual({});
    expect(step.state.cellRuns.c1?.status).toBe("cancelled");
  });

  it("flow failures pause; RETRY re-issues; CANCEL re-arms without retrying", () => {
    let step = apply(init([cmd("c1"), md("m1")]), { type: "START" });
    const inFlight = step.state.inFlight;
    step = transition(step.state, {
      type: "COMMAND_FAILED",
      effectId: inFlight?.effectId ?? "",
      cellId: "c1",
      error: "Command timeout",
      timings: TIMINGS,
    });
    expect(step.state.status).toBe("pausedError");
    expect(step.state.cellRuns.c1?.error).toBe("Command timeout");
    const rearmed = apply(step.state, { type: "CANCEL" });
    expect(rearmed.state.status).toBe("awaitingInput");
    expect(rearmed.state.cellRuns.c1).toBeUndefined();
    const retried = apply(step.state, { type: "RETRY" });
    expect(retried.state.inFlight?.cellId).toBe("c1");
  });

  it("RESET returns to the initial state but keeps minting fresh effect ids", () => {
    let step = apply(init([cmd("c1")]), { type: "START" });
    const seq = step.state.effectSeq;
    step = apply(step.state, { type: "RESET" });
    expect(step.effects[0]?.kind).toBe("cancelEffects");
    expect(step.state.status).toBe("idle");
    expect(step.state.effectSeq).toBe(seq);
  });
});

describe("transition: notebook mode", () => {
  const cells = [cmd("cA"), macro("aB"), cmd("cC"), md("m1")];

  function runAllToEnd(state: RunnerState): RunnerState {
    let step = apply(state, { type: "RUN_ALL" });
    while (step.state.inFlight) {
      const kind = step.state.inFlight.kind;
      step =
        kind === "runMacro"
          ? finishMacro(step.state, { Phi2: 0.7 })
          : finishCommand(step.state, { ok: true });
    }
    return step.state;
  }

  it("RUN_ALL passes over every cell and stamps execution order", () => {
    const state = runAllToEnd(init(cells, { mode: "notebook" }));
    expect(state.status).toBe("idle");
    expect(state.runAllActive).toBe(false);
    expect(state.cellRuns.cA?.executionOrder).toEqual([1]);
    expect(state.cellRuns.aB?.executionOrder).toEqual([2]);
    expect(state.cellRuns.cC?.executionOrder).toEqual([3]);
  });

  it("re-running an upstream producer marks later completed producers stale", () => {
    let state = runAllToEnd(init(cells, { mode: "notebook" }));
    let step = apply(state, { type: "RUN_CELL", cellId: "cA" });
    step = finishCommand(step.state, { ok: 2 });
    state = step.state;
    expect(state.cellRuns.cA?.status).toBe("completed");
    expect(state.cellRuns.aB?.status).toBe("stale");
    expect(state.cellRuns.cC?.status).toBe("stale");
    expect(state.outputs.aB).toBeDefined();
    // Re-running the macro clears its stale flag but leaves cC stale.
    step = apply(state, { type: "RUN_CELL", cellId: "aB" });
    step = finishMacro(step.state, { Phi2: 0.9 });
    expect(step.state.cellRuns.aB?.status).toBe("completed");
    expect(step.state.cellRuns.cC?.status).toBe("stale");
  });

  it("a failing cell does not stop a RUN_ALL pass", () => {
    let step = apply(init(cells, { mode: "notebook" }), { type: "RUN_ALL" });
    step = transition(step.state, {
      type: "COMMAND_FAILED",
      effectId: step.state.inFlight?.effectId ?? "",
      cellId: "cA",
      error: "boom",
      timings: TIMINGS,
    });
    // The pass moved on to the macro.
    expect(step.state.cellRuns.cA?.status).toBe("error");
    expect(step.state.inFlight?.cellId).toBe("aB");
  });

  it("STOP ends the pass between cells", () => {
    let step = apply(init(cells, { mode: "notebook" }), { type: "RUN_ALL" });
    step = apply(step.state, { type: "STOP" });
    step = finishCommand(step.state, { ok: 1 });
    expect(step.state.status).toBe("idle");
    expect(step.state.runAllActive).toBe(false);
    expect(step.state.cellRuns.aB).toBeUndefined();
  });

  it("CLEAR_OUTPUTS wipes outputs, run records, and counters", () => {
    const state = runAllToEnd(init(cells, { mode: "notebook" }));
    const step = apply(state, { type: "CLEAR_OUTPUTS" });
    expect(step.state.outputs).toEqual({});
    expect(step.state.cellRuns).toEqual({});
    expect(step.state.execCounter).toBe(0);
  });

  it("a suspended pass resumes when the question is answered", () => {
    const withQuestion = [cmd("cA"), question("q1", "Pick"), cmd("cC")];
    let step = apply(init(withQuestion, { mode: "notebook" }), { type: "RUN_ALL" });
    step = finishCommand(step.state, { ok: 1 });
    expect(step.state.status).toBe("awaitingInput");
    expect(step.state.position.cellId).toBe("q1");
    step = apply(step.state, { type: "ANSWER", cellId: "q1", value: "yes" });
    expect(step.state.inFlight?.cellId).toBe("cC");
  });

  it("an off-position answer does not disturb a suspended pass", () => {
    const withQuestions = [question("q0", "Zero"), cmd("cA"), question("q1", "Pick"), cmd("cC")];
    let step = apply(init(withQuestions, { mode: "notebook" }), { type: "RUN_ALL" });
    step = apply(step.state, { type: "ANSWER", cellId: "q0", value: "a" });
    step = finishCommand(step.state, { ok: 1 });
    expect(step.state.position.cellId).toBe("q1");
    step = apply(step.state, { type: "ANSWER", cellId: "q0", value: "b" });
    expect(step.state.status).toBe("awaitingInput");
    expect(step.state.runAllActive).toBe(true);
    expect(step.state.position.cellId).toBe("q1");
    step = apply(step.state, { type: "ANSWER", cellId: "q1", value: "yes" });
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
    const log: WorkbookEvent[] = [
      { type: "START" },
      { type: "ANSWER", cellId: "q1", value: "yes" },
    ];

    let live = apply(init(cells), ...log);
    const doneCmd: WorkbookEvent = {
      type: "COMMAND_DONE",
      effectId: live.state.inFlight?.effectId ?? "",
      cellId: "c1",
      output: { raw: [1, 2] },
      timings: TIMINGS,
    };
    log.push(doneCmd);
    live = transition(live.state, doneCmd);
    const doneMacro: WorkbookEvent = {
      type: "MACRO_DONE",
      effectId: live.state.inFlight?.effectId ?? "",
      cellId: "a1",
      output: { Phi2: 0.7 },
      timings: TIMINGS,
    };
    log.push(doneMacro);
    live = transition(live.state, doneMacro);

    const replayed = apply(init(cells), ...log);
    expect(replayed.state).toEqual(live.state);
  });

  it("transition is pure: same result twice, input state untouched", () => {
    const before = apply(init([question("q1", "Pick"), cmd("c1")]), { type: "START" }).state;
    const frozen = JSON.parse(JSON.stringify(before)) as unknown;
    const event: WorkbookEvent = { type: "ANSWER", cellId: "q1", value: "yes" };
    const a = transition(before, event);
    const b = transition(before, event);
    expect(a.state).toEqual(b.state);
    expect(a.effects).toEqual(b.effects);
    expect(JSON.parse(JSON.stringify(before))).toEqual(frozen);
  });
});
