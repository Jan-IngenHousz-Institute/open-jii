import { describe, expect, it } from "vitest";

import type { BranchCell } from "@repo/api/schemas/workbook-cells.schema";
import { evaluateBranch } from "@repo/api/utils/evaluate-branch";

import type { RunnerCell } from "../cells";
import { asWorkbookCells, hydrateCells } from "./hydrate";
import { normalizeOutputData } from "./normalize-output";

const cells: RunnerCell[] = [
  {
    id: "q1",
    type: "question",
    isCollapsed: false,
    name: "Sunlight",
    question: { kind: "yes_no", text: "Sunlight?", required: false },
    isAnswered: false,
  },
  { id: "c1", type: "command", payload: { format: "string", content: "battery" } },
  { id: "out_c1", type: "output", isCollapsed: false, producedBy: "c1" },
  { id: "c2", type: "command", payload: { format: "string", content: "hello" } },
];

describe("normalizeOutputData", () => {
  it("unwraps sample envelopes and boxes scalar samples", () => {
    expect(normalizeOutputData({ sample: [{ Phi2: 0.7 }] })).toEqual([{ Phi2: 0.7 }]);
    expect(normalizeOutputData({ sample: { Phi2: 0.7 } })).toEqual([{ Phi2: 0.7 }]);
    expect(normalizeOutputData({ Phi2: 0.7 })).toEqual({ Phi2: 0.7 });
    expect(normalizeOutputData("82%")).toBe("82%");
    expect(normalizeOutputData(null)).toBeNull();
  });
});

describe("hydrateCells", () => {
  it("overlays current-cycle answers and fills program output cells", () => {
    const hydrated = hydrateCells(cells, { q1: "yes" }, { c1: { v: { level: 82 } } });
    const q = hydrated.find((c) => c.id === "q1");
    if (q?.type !== "question") throw new Error("q1 missing");
    expect(q.answer).toBe("yes");
    const out = hydrated.find((c) => c.id === "out_c1");
    if (out?.type !== "output") throw new Error("out_c1 missing");
    expect(out.data).toEqual({ level: 82 });
  });

  it("appends synthetic output cells for producers without one", () => {
    const hydrated = hydrateCells(cells, {}, { c2: { v: { sample: [{ ok: 1 }] } } });
    const synthetic = hydrated.find((c) => c.type === "output" && c.producedBy === "c2");
    if (synthetic?.type !== "output") throw new Error("synthetic missing");
    expect(synthetic.data).toEqual([{ ok: 1 }]);
  });

  it("never sample-unwraps macro outputs (only device responses)", () => {
    const withMacro: RunnerCell[] = [
      ...cells,
      {
        id: "a1",
        type: "macro",
        isCollapsed: false,
        payload: { macroId: "5f1f9c1a-2c1e-4f6a-9d1b-000000000009", language: "javascript" },
      },
    ];
    const macroOutput = { sample: 5, mean: 3 };
    const hydrated = hydrateCells(withMacro, {}, { a1: { v: macroOutput } });
    const out = hydrated.find((c) => c.type === "output" && c.producedBy === "a1");
    if (out?.type !== "output") throw new Error("macro output missing");
    expect(out.data).toEqual(macroOutput);
    // Dispatch-step outputs are device responses and DO unwrap.
    const dispatched = hydrateCells(
      withMacro,
      {},
      { a1__dispatch: { v: { sample: [{ ok: 1 }] } } },
    );
    const dOut = dispatched.find((c) => c.type === "output" && c.producedBy === "a1__dispatch");
    if (dOut?.type !== "output") throw new Error("dispatch output missing");
    expect(dOut.data).toEqual([{ ok: 1 }]);
  });

  it("makes the same authored condition match web- and mobile-shaped responses", () => {
    const branch: BranchCell = {
      id: "b1",
      type: "branch",
      isCollapsed: false,
      paths: [
        {
          id: "hit",
          label: "hit",
          color: "#000",
          conditions: [
            { id: "c", sourceCellId: "c2", field: "Phi2", operator: "gt", value: "0.5" },
          ],
          gotoCellId: "c1",
        },
      ],
    };
    const program = [...cells, branch];
    const webShaped = hydrateCells(program, {}, { c2: { v: { Phi2: 0.7 } } });
    const mobileShaped = hydrateCells(program, {}, { c2: { v: { sample: [{ Phi2: 0.7 }] } } });
    expect(evaluateBranch(branch, asWorkbookCells(webShaped))?.id).toBe("hit");
    expect(evaluateBranch(branch, asWorkbookCells(mobileShaped))?.id).toBe("hit");
  });
});
