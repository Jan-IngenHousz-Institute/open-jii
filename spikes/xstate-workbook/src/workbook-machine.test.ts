import { createActor } from "xstate";
import { describe, expect, it } from "vitest";

import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";

import { sampleMacroRegistry, sampleWorkbook } from "./sample-workbook";
import { createRuntime, type WorkbookRuntime } from "./runtime";

const GOOD_SCAN = [[0.21, 0.83, 0.79, 0.74]];
import { buildWorkbookMachine, createWorkbookActor } from "./workbook-machine";

const tick = () => new Promise((r) => setTimeout(r, 0));

// Drive an actor to a final state: answer questions "yes", advance instructions,
// let measurement/macro/branch steps auto-advance.
async function runToCompletion(
  cells: WorkbookCell[],
  runtime: WorkbookRuntime,
  input?: { answers?: Record<string, string> },
) {
  const actor = createWorkbookActor(cells, runtime, input);
  actor.start();
  let guard = 0;
  while (actor.getSnapshot().status === "active" && guard++ < 1000) {
    const value = String(actor.getSnapshot().value);
    const cell = cells.find((c) => c.id === value);
    if (cell?.type === "markdown") {
      actor.send({ type: "NEXT" });
    } else if (cell?.type === "question") {
      actor.send({ type: "ANSWER", cellId: cell.id, value: "yes" });
    } else {
      await tick();
    }
  }
  return actor.getSnapshot();
}

describe("workbookToMachine", () => {
  it("runs a good reading straight through to done", async () => {
    const snap = await runToCompletion(sampleWorkbook, createRuntime(sampleMacroRegistry, GOOD_SCAN));

    expect(snap.status).toBe("done");
    expect(snap.context.answers.q_sunlight).toBe("yes");
    // Phi2 = (max - first)/max of the good scan = (0.83 - 0.21)/0.83
    expect((snap.context.outputs.macro_phi2 as { Phi2: number }).Phi2).toBe(0.747);
    // branch entered once, no loop-back
    expect(snap.context.visits.branch_quality).toBe(1);
    const measurements = snap.context.trace.filter((l) => l === "measurement proto_psii");
    expect(measurements).toHaveLength(1);
  });

  it("runs a real macro executor: reads the upstream scan AND the ctx namespace", async () => {
    const snap = await runToCompletion(sampleWorkbook, createRuntime(sampleMacroRegistry, GOOD_SCAN));
    const out = snap.context.outputs.macro_phi2 as {
      Phi2: number;
      sunlit: boolean;
      messages: { info: string[] };
    };
    // computed from json.raw_fluorescence the protocol produced
    expect(out.Phi2).toBe(0.747);
    // the macro saw ctx.answers.q_sunlight === "yes"
    expect(out.sunlit).toBe(true);
    expect(out.messages.info[0]).toContain("computed Phi2 from 4 points");
  });

  it("dispatches a protocol the macro constructed, validated/inspected via @repo/iot", async () => {
    const snap = await runToCompletion(sampleWorkbook, createRuntime(sampleMacroRegistry, GOOD_SCAN));

    // the good reading made the macro hand back a constructed protocol...
    const macroOut = snap.context.outputs.macro_phi2 as { __dispatch?: unknown };
    expect(macroOut.__dispatch).toBeDefined();

    // ...and the machine ran it, recording the real @repo/iot inspection
    const dispatched = snap.context.outputs["macro_phi2__dispatch"] as {
      dispatched: boolean;
      family: string;
      estimateMs: number;
      requiresInteraction: boolean;
    };
    expect(dispatched.dispatched).toBe(true);
    expect(dispatched.family).toBe("multispeq");
    // 20 pulses x 3 detector channels x 1000us = 60ms
    expect(dispatched.estimateMs).toBe(60);
    expect(dispatched.requiresInteraction).toBe(false);
    expect(snap.context.trace).toContain("dispatch macro_phi2");
  });

  it("loops back to remeasure when the branch condition matches, then continues", async () => {
    // default scan: noisy first reading -> macro computes Phi2 0.475 (< 0.5) ->
    // remeasure; clean second reading -> Phi2 0.747 clears the branch
    const snap = await runToCompletion(sampleWorkbook, createRuntime(sampleMacroRegistry));

    expect(snap.status).toBe("done");
    // the protocol ran twice: original + the branch loop-back
    const measurements = snap.context.trace.filter((l) => l === "measurement proto_psii");
    expect(measurements).toHaveLength(2);
    expect(snap.context.visits.branch_quality).toBe(2);
    expect((snap.context.outputs.macro_phi2 as { Phi2: number }).Phi2).toBe(0.747);
    // only the good (second) reading constructs + dispatches a follow-up
    const dispatches = snap.context.trace.filter((l) => l === "dispatch macro_phi2");
    expect(dispatches).toHaveLength(1);
  });

  it("accumulates question answers and step outputs into context (the ctx namespace)", async () => {
    const snap = await runToCompletion(sampleWorkbook, createRuntime(sampleMacroRegistry, GOOD_SCAN));

    expect(snap.context.answers).toEqual({ q_sunlight: "yes" });
    expect(Object.keys(snap.context.outputs).sort()).toEqual([
      "macro_phi2",
      "macro_phi2__dispatch",
      "proto_psii",
    ]);
  });

  it("ignores ANSWER events that target a different cell", async () => {
    const actor = createWorkbookActor(sampleWorkbook, createRuntime(sampleMacroRegistry));
    actor.start();
    actor.send({ type: "NEXT" }); // past md_intro, now on q_sunlight
    expect(actor.getSnapshot().value).toBe("q_sunlight");
    actor.send({ type: "ANSWER", cellId: "some_other_cell", value: "yes" });
    expect(actor.getSnapshot().value).toBe("q_sunlight"); // unchanged
    actor.send({ type: "ANSWER", cellId: "q_sunlight", value: "yes" });
    expect(actor.getSnapshot().value).not.toBe("q_sunlight");
  });

  it("produces a JSON-serializable persisted snapshot that restores and resumes", async () => {
    const machine = buildWorkbookMachine(sampleWorkbook, createRuntime(sampleMacroRegistry, GOOD_SCAN));
    const a1 = createActor(machine, { input: { cells: sampleWorkbook } });
    a1.start();
    a1.send({ type: "NEXT" }); // advance off the first instruction
    const frozen = a1.getPersistedSnapshot();
    a1.stop();

    const roundTripped = JSON.parse(JSON.stringify(frozen));
    expect(roundTripped).toEqual(frozen);

    const a2 = createActor(machine, { snapshot: roundTripped, input: { cells: sampleWorkbook } });
    a2.start();
    expect(a2.getSnapshot().value).toBe("q_sunlight"); // resumed where we froze

    let guard = 0;
    while (a2.getSnapshot().status === "active" && guard++ < 1000) {
      const value = String(a2.getSnapshot().value);
      const cell = sampleWorkbook.find((c) => c.id === value);
      if (cell?.type === "markdown") a2.send({ type: "NEXT" });
      else if (cell?.type === "question") a2.send({ type: "ANSWER", cellId: cell.id, value: "yes" });
      else await tick();
    }
    expect(a2.getSnapshot().status).toBe("done");
  });
});
