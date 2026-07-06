import { describe, it, expect } from "vitest";

import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";
import { resolveConditionValue } from "@repo/api/utils/evaluate-branch";

import type { CommandCellLike } from "../cells";
import { isCommandCell } from "../cells";
import { buildCellNamespace, resolveOutputData } from "./build-cell-namespace";

const uuid = "11111111-1111-1111-1111-111111111111";

function protocol(id: string, name?: string): WorkbookCell {
  return {
    id,
    type: "protocol",
    isCollapsed: false,
    payload: { protocolId: uuid, version: 1, name },
  };
}
function macro(id: string, name?: string): WorkbookCell {
  return {
    id,
    type: "macro",
    isCollapsed: false,
    payload: { macroId: uuid, language: "javascript", name },
  };
}
function output(producedBy: string, data: unknown): WorkbookCell {
  return { id: `out-${producedBy}`, type: "output", isCollapsed: false, producedBy, data };
}
function question(id: string, name: string, answer?: string): WorkbookCell {
  return {
    id,
    type: "question",
    isCollapsed: false,
    name,
    isAnswered: answer != null,
    question: { kind: "open_ended", text: "?", required: false },
    ...(answer != null ? { answer } : {}),
  };
}
function command(id: string, name?: string): CommandCellLike {
  return {
    id,
    type: "command",
    isCollapsed: false,
    payload: { format: "string", content: "battery", name },
  };
}

describe("buildCellNamespace", () => {
  it("keys protocol and command outputs by id and by canonical name", () => {
    const cells = [
      protocol("p1", "Baseline"),
      output("p1", { value: 0.8 }),
      command("c1", "Battery Check"),
      output("c1", { level: 87 }),
    ];
    const ns = buildCellNamespace(cells);
    expect(ns.byId.p1).toEqual({ value: 0.8 });
    expect(ns.ctx.baseline).toEqual({ value: 0.8 });
    expect(ns.names.baseline).toBe("p1");
    expect(ns.byId.c1).toEqual({ level: 87 });
    expect(ns.ctx.battery_check).toEqual({ level: 87 });
    expect(ns.names.battery_check).toBe("c1");
  });

  it("answered questions surface as { answer }; unanswered/no-output/unnamed cells thin out", () => {
    const answered = buildCellNamespace([question("q1", "Soil moisture", "wet")]);
    expect(answered.byId.q1).toEqual({ answer: "wet" });
    expect(answered.ctx.soil_moisture).toEqual({ answer: "wet" });
    // Unanswered questions and producers without output are omitted entirely.
    const empty = buildCellNamespace([question("q1", "Unanswered"), protocol("p1", "NoRun")]);
    expect(empty.byId).toEqual({});
    expect(empty.ctx).toEqual({});
    // Unnamed producers appear in byId but not ctx.
    const unnamed = buildCellNamespace([protocol("p1"), output("p1", { v: 1 })]);
    expect(unnamed.byId.p1).toEqual({ v: 1 });
    expect(unnamed.ctx).toEqual({});
  });

  it("unwraps a non-empty array output to its first element", () => {
    const cells = [protocol("p1", "Scan"), output("p1", [{ value: 1 }, { value: 2 }])];
    expect(buildCellNamespace(cells).ctx.scan).toEqual({ value: 1 });
  });

  it("only sees cells strictly before beforeIndex (upstream-only)", () => {
    const cells = [
      protocol("p1", "Up"),
      output("p1", { value: 1 }),
      macro("m1", "Self"),
      output("m1", { value: 2 }),
      protocol("p2", "Down"),
      output("p2", { value: 3 }),
    ];
    // From the macro's position (index 2), only p1's output is visible.
    const ns = buildCellNamespace(cells, 2);
    expect(ns.ctx.up).toEqual({ value: 1 });
    expect(ns.ctx.self).toBeUndefined();
    expect(ns.ctx.down).toBeUndefined();
  });

  it("reads an upstream output many cells back", () => {
    const cells = [
      protocol("p1", "Baseline"),
      output("p1", { value: 0.8 }),
      { id: "md1", type: "markdown", isCollapsed: false, content: "note" } as WorkbookCell,
      question("q1", "Note", "ok"),
      protocol("p2", "Stress"),
      output("p2", { value: 0.4 }),
      macro("m1", "Compare"),
    ];
    const ns = buildCellNamespace(cells, cells.length - 1);
    expect(ns.ctx.baseline).toEqual({ value: 0.8 });
    expect(ns.ctx.stress).toEqual({ value: 0.4 });
    expect(ns.ctx.note).toEqual({ answer: "ok" });
  });
});

describe("resolveOutputData", () => {
  it("returns undefined when no output exists or the array output is empty", () => {
    expect(resolveOutputData([protocol("p1")], "p1")).toBeUndefined();
    expect(resolveOutputData([protocol("p1"), output("p1", [])], "p1")).toBeUndefined();
  });
});

describe("isCommandCell", () => {
  it("narrows command cells and rejects others", () => {
    expect(isCommandCell(command("c1"))).toBe(true);
    expect(isCommandCell(protocol("p1"))).toBe(false);
    expect(isCommandCell(question("q1", "Q"))).toBe(false);
  });
});

describe("parity with resolveConditionValue", () => {
  // The namespace must project the same field value a branch condition reads,
  // so branch routing and macro ctx can never disagree.
  const cases: { data: unknown; field: string }[] = [
    { data: { "Fv/Fm": 0.7 }, field: "Fv/Fm" },
    { data: { label: "green" }, field: "label" },
    { data: [{ value: 42 }], field: "value" },
    { data: { nested: { a: 1 } }, field: "nested" },
    { data: { value: 1 }, field: "missing" },
  ];

  it.each(cases)("field $field matches between ctx and branch resolver", ({ data, field }) => {
    const cells = [protocol("p1", "Src"), output("p1", data)];
    const fromBranch = resolveConditionValue(cells, "p1", field);
    const nsData = buildCellNamespace(cells).byId.p1 as Record<string, unknown> | undefined;
    const raw = nsData?.[field];
    const fromNs =
      typeof raw === "number" || typeof raw === "string"
        ? raw
        : raw != null
          ? JSON.stringify(raw)
          : undefined;
    expect(fromNs).toEqual(fromBranch);
  });
});
