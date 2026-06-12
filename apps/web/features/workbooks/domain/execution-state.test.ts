import {
  createBranchCell,
  createMacroCell,
  createMarkdownCell,
  createOutputCell,
  createProtocolCell,
  createQuestionCell,
} from "@/test/factories";
import { describe, expect, it } from "vitest";

import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";

import type { ExecutionStates } from "./execution-state";
import {
  MAX_VISITS_PER_CELL,
  applyCellState,
  evaluateBranchCell,
  findPrecedingOutputData,
  foldExecutionError,
  foldExecutionSuccess,
  foldQuestionAnswered,
  hasQuestionText,
  insertOutputAfterCell,
  isRunnableCell,
  makeErrorOutputCell,
  makeOutputCell,
  recordVisit,
  resolveBranchJump,
  stampExecutionStart,
} from "./execution-state";

function findOutput(cells: WorkbookCell[], producedBy: string) {
  const output = cells.find((c) => c.type === "output" && c.producedBy === producedBy);
  return output?.type === "output" ? output : undefined;
}

describe("applyCellState", () => {
  it("replaces status while preserving executionOrder", () => {
    const states: ExecutionStates = {
      "c-1": { status: "running", executionOrder: [1, 2] },
    };

    const next = applyCellState(states, "c-1", { status: "completed" });

    expect(next["c-1"]).toEqual({ status: "completed", executionOrder: [1, 2] });
  });

  it("drops a previous error when the new state has none", () => {
    const states: ExecutionStates = {
      "c-1": { status: "error", error: "boom", executionOrder: [1] },
    };

    const next = applyCellState(states, "c-1", { status: "running" });

    expect(next["c-1"]).toEqual({ status: "running", executionOrder: [1] });
  });

  it("does not touch other cells", () => {
    const states: ExecutionStates = {
      "c-1": { status: "running", executionOrder: [1] },
      "c-2": { status: "idle", executionOrder: [2] },
    };

    const next = applyCellState(states, "c-1", { status: "completed" });

    expect(next["c-2"]).toBe(states["c-2"]);
  });
});

describe("stampExecutionStart", () => {
  it("marks an unseen cell running with its first order", () => {
    const next = stampExecutionStart({}, "c-1", 1);

    expect(next["c-1"]).toEqual({ status: "running", executionOrder: [1] });
  });

  it("appends to the existing execution order", () => {
    const states: ExecutionStates = {
      "c-1": { status: "completed", executionOrder: [1] },
    };

    const next = stampExecutionStart(states, "c-1", 3);

    expect(next["c-1"].status).toBe("running");
    expect(next["c-1"].executionOrder).toEqual([1, 3]);
  });

  it("preserves a previous error on the restarted cell", () => {
    const states: ExecutionStates = {
      "c-1": { status: "error", error: "boom", executionOrder: [1] },
    };

    const next = stampExecutionStart(states, "c-1", 2);

    expect(next["c-1"].error).toBe("boom");
  });
});

describe("isRunnableCell", () => {
  it("rejects output and markdown cells", () => {
    expect(isRunnableCell(createOutputCell())).toBe(false);
    expect(isRunnableCell(createMarkdownCell())).toBe(false);
  });

  it("accepts protocol, macro, question and branch cells", () => {
    expect(isRunnableCell(createProtocolCell())).toBe(true);
    expect(isRunnableCell(createMacroCell())).toBe(true);
    expect(isRunnableCell(createQuestionCell())).toBe(true);
    expect(isRunnableCell(createBranchCell())).toBe(true);
  });
});

describe("recordVisit", () => {
  it("counts visits with 1-based passes", () => {
    const first = recordVisit({}, "c-1");
    expect(first).toEqual({ counts: { "c-1": 1 }, pass: 1, blocked: false });

    const second = recordVisit(first.counts, "c-1");
    expect(second.pass).toBe(2);
    expect(second.blocked).toBe(false);
  });

  it("blocks at the visit cap without incrementing", () => {
    const counts = { "c-1": MAX_VISITS_PER_CELL };

    const visit = recordVisit(counts, "c-1");

    expect(visit.blocked).toBe(true);
    expect(visit.counts).toBe(counts);
  });

  it("tracks cells independently", () => {
    const visit = recordVisit({ "c-1": 5 }, "c-2");

    expect(visit.counts).toEqual({ "c-1": 5, "c-2": 1 });
  });
});

describe("hasQuestionText", () => {
  it("rejects empty and whitespace-only text", () => {
    const empty = createQuestionCell({
      question: { kind: "open_ended", text: "", required: false },
    });
    const blank = createQuestionCell({
      question: { kind: "open_ended", text: "   ", required: false },
    });

    expect(hasQuestionText(empty)).toBe(false);
    expect(hasQuestionText(blank)).toBe(false);
  });

  it("accepts non-empty text", () => {
    expect(hasQuestionText(createQuestionCell())).toBe(true);
  });
});

describe("findPrecedingOutputData", () => {
  it("returns the nearest preceding output data", () => {
    const cells: WorkbookCell[] = [
      createOutputCell({ data: { far: 1 } }),
      createOutputCell({ data: { near: 2 } }),
      createMacroCell(),
    ];

    expect(findPrecedingOutputData(cells, 2)).toEqual({ near: 2 });
  });

  it("skips outputs without data", () => {
    const cells: WorkbookCell[] = [
      createOutputCell({ data: { value: 1 } }),
      createOutputCell({ data: undefined }),
      createMacroCell(),
    ];

    expect(findPrecedingOutputData(cells, 2)).toEqual({ value: 1 });
  });

  it("ignores outputs at or after the index", () => {
    const cells: WorkbookCell[] = [createMacroCell(), createOutputCell({ data: { value: 1 } })];

    expect(findPrecedingOutputData(cells, 0)).toBeNull();
  });
});

describe("resolveBranchJump", () => {
  it("returns the index of the goto cell of the evaluated path", () => {
    const target = createProtocolCell({ id: "target" });
    const branch = createBranchCell({
      id: "b-1",
      evaluatedPathId: "p-1",
      paths: [{ id: "p-1", label: "Yes", color: "#fff", conditions: [], gotoCellId: "target" }],
    });

    expect(resolveBranchJump("b-1", [branch, target])).toBe(1);
  });

  it("returns -1 when the branch has not been evaluated", () => {
    const branch = createBranchCell({ id: "b-1" });

    expect(resolveBranchJump("b-1", [branch])).toBe(-1);
  });

  it("returns -1 when the matched path has no goto", () => {
    const branch = createBranchCell({
      id: "b-1",
      evaluatedPathId: "p-1",
      paths: [{ id: "p-1", label: "Yes", color: "#fff", conditions: [] }],
    });

    expect(resolveBranchJump("b-1", [branch])).toBe(-1);
  });

  it("returns -1 for a non-branch cell", () => {
    const proto = createProtocolCell({ id: "c-1" });

    expect(resolveBranchJump("c-1", [proto])).toBe(-1);
  });
});

describe("makeOutputCell / makeErrorOutputCell", () => {
  it("builds an expanded output cell with a fresh id", () => {
    const a = makeOutputCell("src-1", { value: 1 }, 12, ["msg"]);
    const b = makeOutputCell("src-1", { value: 1 }, 12, ["msg"]);

    expect(a).toMatchObject({
      type: "output",
      isCollapsed: false,
      producedBy: "src-1",
      data: { value: 1 },
      executionTime: 12,
      messages: ["msg"],
    });
    expect(a.id).not.toBe(b.id);
  });

  it("builds an error output with the error as its only message", () => {
    const cell = makeErrorOutputCell("src-1", "boom");

    expect(cell.data).toBeUndefined();
    expect(cell.executionTime).toBe(0);
    expect(cell.messages).toEqual(["boom"]);
  });
});

describe("insertOutputAfterCell", () => {
  it("inserts the output directly after its source cell", () => {
    const proto = createProtocolCell({ id: "p-1" });
    const macro = createMacroCell({ id: "m-1" });
    const output = makeOutputCell("p-1", { value: 1 }, 0, []);

    const updated = insertOutputAfterCell([proto, macro], "p-1", output);

    expect(updated.map((c) => c.id)).toEqual(["p-1", output.id, "m-1"]);
  });

  it("replaces a previous output from the same source", () => {
    const proto = createProtocolCell({ id: "p-1" });
    const stale = createOutputCell({ producedBy: "p-1", data: { old: true } });
    const fresh = makeOutputCell("p-1", { old: false }, 0, []);

    const updated = insertOutputAfterCell([proto, stale], "p-1", fresh);

    expect(updated).toHaveLength(2);
    expect(findOutput(updated, "p-1")?.data).toEqual({ old: false });
  });

  it("keeps outputs from other sources", () => {
    const p1 = createProtocolCell({ id: "p-1" });
    const otherOutput = createOutputCell({ producedBy: "p-other" });
    const output = makeOutputCell("p-1", undefined, 0, []);

    const updated = insertOutputAfterCell([p1, otherOutput], "p-1", output);

    expect(updated.filter((c) => c.type === "output")).toHaveLength(2);
  });
});

describe("foldExecutionSuccess", () => {
  it("completes the cell and emits its data output", () => {
    const proto = createProtocolCell({ id: "p-1" });

    const fold = foldExecutionSuccess([proto], "p-1", { measurement: 42 }, 15);

    expect(fold.state).toEqual({ status: "completed" });
    const output = findOutput(fold.cells, "p-1");
    expect(output?.data).toEqual({ measurement: 42 });
    expect(output?.executionTime).toBe(15);
    expect(output?.messages).toEqual([]);
  });
});

describe("foldExecutionError", () => {
  it("errors the cell with the error as the output message by default", () => {
    const proto = createProtocolCell({ id: "p-1" });

    const fold = foldExecutionError([proto], "p-1", "Device timed out");

    expect(fold.state).toEqual({ status: "error", error: "Device timed out" });
    expect(findOutput(fold.cells, "p-1")?.messages).toEqual(["Device timed out"]);
  });

  it("lets the output carry a longer message than the state error", () => {
    const proto = createProtocolCell({ id: "p-1" });

    const fold = foldExecutionError([proto], "p-1", "No device connected", {
      outputMessage: "No device connected - connect a device to run this protocol",
    });

    expect(fold.state.error).toBe("No device connected");
    expect(findOutput(fold.cells, "p-1")?.messages).toEqual([
      "No device connected - connect a device to run this protocol",
    ]);
  });

  it("records the execution time on the output", () => {
    const macro = createMacroCell({ id: "m-1" });

    const fold = foldExecutionError([macro], "m-1", "boom", { executionTime: 33 });

    expect(findOutput(fold.cells, "m-1")?.executionTime).toBe(33);
  });
});

describe("foldQuestionAnswered", () => {
  it("records the answer on the cell and emits an answer output", () => {
    const q = createQuestionCell({ id: "q-1" });

    const fold = foldQuestionAnswered([q], q, "42");

    expect(fold.state).toEqual({ status: "completed" });
    const answered = fold.cells.find((c) => c.id === "q-1");
    expect(answered).toMatchObject({ answer: "42", isAnswered: true });
    expect(findOutput(fold.cells, "q-1")?.data).toEqual({ answer: "42" });
  });
});

describe("evaluateBranchCell", () => {
  const yesPath = {
    id: "path-yes",
    label: "Yes path",
    color: "#22c55e",
    conditions: [
      { id: "cond-1", sourceCellId: "q-1", field: "answer", operator: "eq" as const, value: "yes" },
    ],
  };

  it("errors with joined config errors for a misconfigured branch", () => {
    const branch = createBranchCell({
      id: "b-1",
      paths: [
        {
          id: "bad",
          label: "Bad",
          color: "#f00",
          conditions: [
            { id: "cond-1", sourceCellId: "", field: "", operator: "eq" as const, value: "" },
          ],
        },
      ],
    });

    const fold = evaluateBranchCell(branch, [branch]);

    expect(fold.state.status).toBe("error");
    expect(fold.state.error).toContain("; ");
    const output = findOutput(fold.cells, "b-1");
    expect(output?.messages?.length).toBeGreaterThan(1);
  });

  it("records the matched path and reports it in the output", () => {
    const q = createQuestionCell({ id: "q-1", answer: "yes", isAnswered: true });
    const branch = createBranchCell({ id: "b-1", paths: [yesPath] });

    const fold = evaluateBranchCell(branch, [q, branch]);

    expect(fold.state).toEqual({ status: "completed" });
    const updatedBranch = fold.cells.find((c) => c.id === "b-1");
    expect(updatedBranch).toHaveProperty("evaluatedPathId", "path-yes");
    expect(findOutput(fold.cells, "b-1")?.messages).toEqual(["Matched: Yes path"]);
  });

  it("reports when no path matched and clears the evaluated path", () => {
    const q = createQuestionCell({ id: "q-1", answer: "no", isAnswered: true });
    const branch = createBranchCell({ id: "b-1", paths: [yesPath], evaluatedPathId: "path-yes" });

    const fold = evaluateBranchCell(branch, [q, branch]);

    const updatedBranch = fold.cells.find((c) => c.id === "b-1");
    expect(updatedBranch).toHaveProperty("evaluatedPathId", undefined);
    expect(findOutput(fold.cells, "b-1")?.messages).toEqual(["No path matched"]);
  });

  it("labels the pass on repeated evaluation", () => {
    const q = createQuestionCell({ id: "q-1", answer: "yes", isAnswered: true });
    const branch = createBranchCell({ id: "b-1", paths: [yesPath] });

    const fold = evaluateBranchCell(branch, [q, branch], 2);

    expect(findOutput(fold.cells, "b-1")?.messages).toEqual(["Matched: Yes path (pass 2)"]);
  });
});
