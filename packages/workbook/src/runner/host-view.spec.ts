import { describe, expect, it } from "vitest";

import type { OutputCell } from "@repo/api/schemas/workbook-cells.schema";

import type { RunnerCell } from "../cells";
import { branchCell, commandCell, macroCell, questionCell } from "../demo/fixtures";
import { carryOverState, effectiveCellRuns, mergeCellsView, outputsFromCells } from "./host-view";
import type { CellRunState, RunnerState } from "./state";
import { createInitialState } from "./state";

const out = (producedBy: string, data: unknown): OutputCell => ({
  id: `out:${producedBy}`,
  type: "output",
  isCollapsed: false,
  producedBy,
  data,
});

const run = (status: CellRunState["status"], extra: Partial<CellRunState> = {}): CellRunState => ({
  status,
  executionOrder: [1],
  ...extra,
});

function state(cells: RunnerCell[], patch: Partial<RunnerState> = {}): RunnerState {
  return { ...createInitialState({ cells, mode: "notebook" }), ...patch };
}

describe("host-view", () => {
  it("outputsFromCells seeds only outputs owned by producer cells", () => {
    const cells: RunnerCell[] = [
      commandCell("c1"),
      out("c1", { ok: 1 }),
      questionCell("q1", "Q"),
      out("q1", "answer"),
      out("orphan", 5),
      out("c1__dispatch", "82%"),
    ];
    expect(outputsFromCells(cells)).toEqual({ c1: { v: { ok: 1 } }, c1__dispatch: { v: "82%" } });
  });

  it("mergeCellsView inserts, replaces, orders and passes through output cells", () => {
    const cells: RunnerCell[] = [
      commandCell("c1"),
      out("c1", { old: true }),
      macroCell("a1"),
      commandCell("c2"),
      questionCell("q1", "Q"),
      out("q1", "unmanaged"),
    ];
    const st = state(cells, {
      outputs: { c1: { v: { fresh: 1 } }, a1: { v: { r: 2 } }, a1__dispatch: { v: "82%" } },
      cellRuns: {
        c1: run("completed", { executionTimeMs: 5 }),
        a1: run("completed", { executionOrder: [2] }),
        a1__dispatch: run("completed", { executionOrder: [3] }),
        c2: run("error", { error: "boom", executionOrder: [4] }),
      },
    });

    const merged = mergeCellsView(cells, st);
    // Stale c1 output replaced in place; owner output precedes the dispatch
    // step's; failed c2 renders an error output; q1's output passes through.
    expect(merged.map((c) => c.id)).toEqual([
      "c1",
      "out:c1:0:1",
      "a1",
      "out:a1:0:2",
      "out:a1__dispatch:0:3",
      "c2",
      "out:c2:0:4",
      "q1",
      "out:q1",
    ]);
    expect(merged[1]).toMatchObject({ producedBy: "c1", data: { fresh: 1 }, executionTime: 5 });
    expect((merged[6] as OutputCell).messages).toEqual(["boom"]);
    expect((merged[6] as OutputCell).data).toBeUndefined();
    expect(merged[8]).toBe(cells[5]);
    // Idempotence: merging the merged view returns the same array instance.
    expect(mergeCellsView(merged, st)).toBe(merged);
    // No managed results at all: the input array itself comes back.
    const plain: RunnerCell[] = [questionCell("q1", "Q"), out("q1", "yes")];
    expect(mergeCellsView(plain, state(plain))).toBe(plain);
  });

  it.each([
    { name: "matched path", matched: "p1", message: "Matched: p1", evaluated: "p1" },
    { name: "no match", matched: undefined, message: "No path matched", evaluated: undefined },
  ])("mergeCellsView overlays branch results: $name", ({ matched, message, evaluated }) => {
    const b1 = branchCell("b1", [{ id: "p1", goto: "x" }]);
    const st = state([b1], { cellRuns: { b1: run("completed", { lastMatchedPathId: matched }) } });
    const merged = mergeCellsView([b1], st);
    expect((merged[0] as { evaluatedPathId?: string }).evaluatedPathId).toBe(evaluated);
    expect((merged[1] as OutputCell).messages).toEqual([message]);
  });

  it("carryOverState seeds persisted outputs and carries prev state for surviving cells", () => {
    const c1 = commandCell("c1");
    const a1 = macroCell("a1");
    const prev = state([c1, a1, commandCell("gone")], {
      outputs: { c1: { v: 1 }, gone: { v: 2 }, a1__dispatch: { v: 3 } },
      cellRuns: { c1: run("completed"), a1: run("running"), gone: run("completed") },
      execCounter: 7,
      effectSeq: 4,
    });
    const cells: RunnerCell[] = [c1, out("c1", { persisted: true }), a1];

    const restored = carryOverState({ cells, mode: "notebook" }, prev);
    // Prev outputs win over the persisted seed; removed-cell entries drop.
    expect(restored.outputs).toEqual({ c1: { v: 1 }, a1__dispatch: { v: 3 } });
    // Running runs never carry over; counters do.
    expect(restored.cellRuns).toEqual({ c1: prev.cellRuns.c1 });
    expect(restored.execCounter).toBe(7);
    expect(restored.effectSeq).toBe(4);

    const fresh = carryOverState({ cells, mode: "notebook" }, null);
    expect(fresh.outputs).toEqual({ c1: { v: { persisted: true } } });
    expect(fresh.execCounter).toBe(0);
  });

  it("effectiveCellRuns surfaces owner runs, mirrors running dispatch, marks the prompted cell", () => {
    const st = state([macroCell("a1"), commandCell("c1")], {
      cellRuns: {
        a1: run("completed", { executionOrder: [1, 3] }),
        a1__dispatch: run("running"),
        c1: run("error", { error: "boom" }),
      },
    });
    expect(effectiveCellRuns(st, "q9")).toEqual({
      a1: { status: "running", error: undefined, executionOrder: [1, 3] },
      c1: { status: "error", error: "boom", executionOrder: [1] },
      q9: { status: "running" },
    });
    expect(effectiveCellRuns(null, null)).toEqual({});
  });
});
