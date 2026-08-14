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
  defaultPathId: "path-1",
});

const gotoCell = (id: string, gotoCellId?: string): WorkbookCell => ({
  id,
  type: "branch",
  isCollapsed: false,
  paths: [
    {
      id: `${id}-path`,
      label: "Go to",
      color: "#005E5E",
      conditions: [],
      gotoCellId,
    },
  ],
  defaultPathId: `${id}-path`,
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

  it("does not treat the reserved device context as a dangling cell source", () => {
    const cells = [branchCell("b1", "$device")];
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

  it("warns for a cell orphaned by a forward Go to and clears when a path reaches it", () => {
    const orphaned = [gotoCell("goto", "target"), questionCell("orphan"), questionCell("target")];
    expect(validateWorkbook(orphaned, ctx({})).issues).toContainEqual(
      expect.objectContaining({ code: "unreachable-cell", cellId: "orphan" }),
    );

    const branch = orphaned[0];
    if (branch.type !== "branch") throw new Error("expected branch");
    const repaired: WorkbookCell[] = [
      {
        ...branch,
        paths: [
          {
            id: "orphan-path",
            label: "Orphan",
            color: "#005E5E",
            conditions: [
              {
                id: "condition",
                sourceCellId: "target",
                field: "answer",
                operator: "eq",
                value: "yes",
              },
            ],
            gotoCellId: "orphan",
          },
          ...branch.paths,
        ],
      },
      ...orphaned.slice(1),
    ];
    expect(
      validateWorkbook(repaired, ctx({})).issues.filter(
        (issue) => issue.code === "unreachable-cell" && issue.cellId === "orphan",
      ),
    ).toEqual([]);
  });

  it("warns for a backward Go to without blocking validation", () => {
    const result = validateWorkbook([questionCell("target"), gotoCell("goto", "target")], ctx({}));

    expect(result.ok).toBe(true);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "backward-goto-loop", cellId: "goto", ref: "target" }),
    );
  });

  it("blocks a Go to until its target is selected", () => {
    const result = validateWorkbook([gotoCell("goto")], ctx({}));

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        level: "error",
        code: "goto-missing-target",
        cellId: "goto",
      }),
    );
  });

  it("keeps fall-through reachable for self, dangling, and backward Go to targets", () => {
    const cases: WorkbookCell[][] = [
      [gotoCell("goto", "goto"), questionCell("after")],
      [gotoCell("goto", "missing"), questionCell("after")],
      [questionCell("target"), gotoCell("goto", "target"), questionCell("after")],
    ];

    for (const cells of cases) {
      const issues = validateWorkbook(cells, ctx({})).issues;
      expect(
        issues.filter((issue) => issue.code === "unreachable-cell" && issue.cellId === "after"),
      ).toEqual([]);
    }
  });

  it("warns when a branch has no default", () => {
    const branch = branchCell("branch", "source");
    if (branch.type !== "branch") throw new Error("expected branch");
    const result = validateWorkbook(
      [questionCell("source"), { ...branch, defaultPathId: undefined }],
      ctx({}),
    );

    expect(result.ok).toBe(true);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "branch-no-default", cellId: "branch" }),
    );
  });

  it("warns when Otherwise is dangling or ambiguous", () => {
    const branch = branchCell("branch", "source");
    if (branch.type !== "branch") throw new Error("expected branch");
    const duplicatePath = { ...branch.paths[0], label: "Duplicate" };

    const dangling = validateWorkbook(
      [questionCell("source"), { ...branch, defaultPathId: "missing" }],
      ctx({}),
    );
    expect(dangling.issues).toContainEqual(
      expect.objectContaining({ code: "branch-no-default", cellId: "branch" }),
    );

    const ambiguous = validateWorkbook(
      [questionCell("source"), { ...branch, paths: [...branch.paths, duplicatePath] }],
      ctx({}),
    );
    expect(ambiguous.ok).toBe(false);
    expect(ambiguous.issues).toContainEqual(
      expect.objectContaining({ code: "branch-no-default", cellId: "branch" }),
    );
    expect(ambiguous.issues).toContainEqual(
      expect.objectContaining({
        level: "error",
        code: "duplicate-branch-path-id",
        cellId: "branch",
        ref: "path-1",
      }),
    );
  });

  it("warns when a later path has structurally identical conditions", () => {
    const branch = branchCell("branch", "source");
    if (branch.type !== "branch") throw new Error("expected branch");
    const duplicate = {
      ...branch.paths[0],
      id: "path-2",
      label: "Duplicate",
      conditions: branch.paths[0].conditions.map((condition) => ({
        ...condition,
        id: "different-condition-id",
      })),
    };
    const result = validateWorkbook(
      [questionCell("source"), { ...branch, paths: [...branch.paths, duplicate] }],
      ctx({}),
    );

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "path-duplicate-conditions",
        cellId: "branch",
        ref: "path-2",
      }),
    );
  });

  it("deduplicates repeated conditions before comparing paths", () => {
    const branch = branchCell("branch", "source");
    if (branch.type !== "branch") throw new Error("expected branch");
    const condition = branch.paths[0].conditions[0];
    const duplicate = {
      ...branch.paths[0],
      id: "path-2",
      conditions: [condition, { ...condition, id: "repeated-condition" }],
    };

    const result = validateWorkbook(
      [questionCell("source"), { ...branch, paths: [...branch.paths, duplicate] }],
      ctx({}),
    );

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "path-duplicate-conditions",
        cellId: "branch",
        ref: "path-2",
      }),
    );
  });

  it("treats a device-scoped branch as a dispatcher with a fall-through edge", () => {
    const deviceBranch: WorkbookCell = {
      id: "dispatch",
      type: "branch",
      isCollapsed: false,
      paths: [
        {
          id: "multispeq",
          label: "MultispeQ",
          color: "#005E5E",
          conditions: [
            {
              id: "device-condition",
              sourceCellId: "$device",
              field: "family",
              operator: "eq",
              value: "multispeq",
            },
          ],
          gotoCellId: "measurement",
        },
        {
          id: "fallback",
          label: "Fallback",
          color: "#6C5CE7",
          conditions: [],
          gotoCellId: "command",
        },
      ],
      defaultPathId: "fallback",
    };
    const afterDispatch: WorkbookCell = {
      id: "after-dispatch",
      type: "markdown",
      isCollapsed: false,
      content: "All device groups were dispatched",
    };
    const measurement = protocolCell("measurement", "protocol");
    const command: WorkbookCell = {
      id: "command",
      type: "command",
      isCollapsed: false,
      payload: { format: "string", content: "battery" },
    };
    const result = validateWorkbook(
      [deviceBranch, afterDispatch, measurement, command],
      ctx({ protocol: { family: "multispeq" } }),
    );

    expect(result.issues.filter((issue) => issue.code === "unreachable-cell")).toEqual([]);
  });
});
