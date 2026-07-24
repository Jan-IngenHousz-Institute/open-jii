import { describe, it, expect } from "vitest";

import type { WorkbookCell } from "../domains/workbook/workbook-cells.schema";
import { validateWorkbook } from "./validate-workbook";
import type { WorkbookValidationContext } from "./validate-workbook";

const protocolCell = (id: string, protocolId: string): WorkbookCell => ({
  id,
  type: "protocol",
  isCollapsed: false,
  payload: { protocolId, version: 1, name: "Protocol" },
});

const macroCell = (id: string, macroId: string): WorkbookCell => ({
  id,
  type: "macro",
  isCollapsed: false,
  payload: { macroId, language: "python", name: "Macro" },
});

const questionCell = (id: string): WorkbookCell => ({
  id,
  type: "question",
  isCollapsed: false,
  isAnswered: false,
  name: "reading",
  question: { kind: "open_ended", text: "Value?", required: false },
});

const branchCell = (id: string, sourceCellId: string, gotoCellId?: string): WorkbookCell => ({
  id,
  type: "branch",
  isCollapsed: false,
  paths: [
    {
      id: "path-1",
      label: "High",
      color: "#000000",
      conditions: [{ id: "c1", sourceCellId, field: "answer", operator: "gt", value: "1" }],
      gotoCellId,
    },
  ],
});

const ctx = (
  protocols: WorkbookValidationContext["protocols"],
  macros: WorkbookValidationContext["macros"] = {},
): WorkbookValidationContext => ({ protocols, macros });

describe("validateWorkbook", () => {
  it("reports no issues for a well-formed workbook", () => {
    const cells = [protocolCell("p1", "prot-1"), macroCell("m1", "mac-1")];
    const result = validateWorkbook(
      cells,
      ctx({ "prot-1": { family: "multispeq" } }, { "mac-1": {} }),
    );
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("flags a protocol cell whose entity no longer exists", () => {
    const cells = [protocolCell("p1", "gone")];
    const result = validateWorkbook(cells, ctx({}));
    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        level: "error",
        code: "missing-protocol",
        cellId: "p1",
        ref: "gone",
      }),
    );
  });

  it("flags a macro cell whose entity no longer exists", () => {
    const cells = [protocolCell("p1", "prot-1"), macroCell("m1", "gone")];
    const result = validateWorkbook(cells, ctx({ "prot-1": { family: "multispeq" } }, {}));
    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ level: "error", code: "missing-macro", cellId: "m1", ref: "gone" }),
    );
  });

  it("flags dangling branch source and goto references", () => {
    const cells = [questionCell("q1"), branchCell("b1", "removed-source", "removed-target")];
    const result = validateWorkbook(cells, ctx({}));
    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "dangling-branch-source",
        cellId: "b1",
        ref: "removed-source",
      }),
    );
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "dangling-branch-goto",
        cellId: "b1",
        ref: "removed-target",
      }),
    );
  });

  it("accepts branch references that resolve to existing cells", () => {
    const cells = [questionCell("q1"), branchCell("b1", "q1", "q1")];
    const result = validateWorkbook(cells, ctx({}));
    expect(result.issues).toEqual([]);
  });

  it("warns (not errors) when a macro has no upstream measurement", () => {
    const cells = [macroCell("m1", "mac-1"), protocolCell("p1", "prot-1")];
    const result = validateWorkbook(
      cells,
      ctx({ "prot-1": { family: "multispeq" } }, { "mac-1": {} }),
    );
    expect(result.ok).toBe(true);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ level: "warning", code: "macro-without-input", cellId: "m1" }),
    );
  });

  it("warns for every macro in a chain with no protocol upstream", () => {
    const cells = [macroCell("m1", "mac-1"), macroCell("m2", "mac-2")];
    const result = validateWorkbook(cells, ctx({}, { "mac-1": {}, "mac-2": {} }));
    const flagged = result.issues
      .filter((i) => i.code === "macro-without-input")
      .map((i) => i.cellId);
    expect(flagged).toEqual(expect.arrayContaining(["m1", "m2"]));
  });

  it("warns when a workbook mixes sensor families", () => {
    const cells = [protocolCell("p1", "prot-1"), protocolCell("p2", "prot-2")];
    const result = validateWorkbook(
      cells,
      ctx({ "prot-1": { family: "multispeq" }, "prot-2": { family: "ambyte" } }),
    );
    expect(result.ok).toBe(true);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        level: "warning",
        code: "mixed-sensor-families",
        detail: "ambyte, multispeq",
      }),
    );
  });

  it("aggregates dynamic command reference issues as blocking errors", () => {
    const cells: WorkbookCell[] = [
      macroCell("m1", "mac-1"),
      {
        id: "c1",
        type: "command",
        isCollapsed: false,
        payload: { kind: "ref", ref: { sourceCellId: "gone", field: "toDevice" } },
      },
    ];
    const result = validateWorkbook(cells, ctx({}, { "mac-1": {} }));
    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        level: "error",
        code: "DYNAMIC_COMMAND_SOURCE_MISSING",
        cellId: "c1",
        ref: "gone",
        detail: "toDevice",
      }),
    );
  });

  it("does not flag a well-formed dynamic command reference", () => {
    const cells: WorkbookCell[] = [
      macroCell("m1", "mac-1"),
      {
        id: "c1",
        type: "command",
        isCollapsed: false,
        payload: { kind: "ref", ref: { sourceCellId: "m1", field: "toDevice" } },
      },
    ];
    const result = validateWorkbook(cells, ctx({}, { "mac-1": {} }));
    expect(result.issues.some((i) => i.code.startsWith("DYNAMIC_COMMAND"))).toBe(false);
  });
});
