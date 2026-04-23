import { describe, it, expect } from "vitest";

import type { BranchCell, WorkbookCell } from "../schemas/workbook-cells.schema";
import {
  evaluateBranch,
  evaluatePathConditions,
  resolveConditionValue,
  validateBranchCell,
} from "./evaluate-branch";

// --- Helpers ---

function makeOutputCell(id: string, producedBy: string, data: unknown): WorkbookCell {
  return {
    id,
    type: "output",
    isCollapsed: false,
    producedBy,
    data,
    executionTime: 0.1,
    messages: [],
  };
}

function makeQuestionCell(id: string, answer?: string): WorkbookCell {
  return {
    id,
    type: "question",
    isCollapsed: false,
    question: { kind: "open_ended", text: "Test?", required: false },
    answer,
    isAnswered: answer != null,
  };
}

function makeBranchCell(overrides: Partial<BranchCell> & { id: string }): BranchCell {
  return {
    type: "branch",
    isCollapsed: false,
    paths: [],
    ...overrides,
  };
}

// --- Tests ---

describe("resolveConditionValue", () => {
  it("returns undefined for unknown source cell", () => {
    expect(resolveConditionValue([], "unknown", "x")).toBeUndefined();
  });

  it("returns answer from a question cell (field ignored)", () => {
    const cells: WorkbookCell[] = [makeQuestionCell("q1", "Yes")];
    expect(resolveConditionValue(cells, "q1", "anything")).toBe("Yes");
  });

  it("returns undefined for unanswered question", () => {
    const cells: WorkbookCell[] = [makeQuestionCell("q1")];
    expect(resolveConditionValue(cells, "q1", "x")).toBeUndefined();
  });

  it("reads field from flat output data object", () => {
    const cells: WorkbookCell[] = [
      {
        id: "p1",
        type: "protocol",
        isCollapsed: false,
        payload: { protocolId: "11111111-1111-1111-1111-111111111111", version: 1 },
      },
      makeOutputCell("o1", "p1", { temperature: 25.5, status: "ok" }),
    ];
    expect(resolveConditionValue(cells, "p1", "temperature")).toBe(25.5);
    expect(resolveConditionValue(cells, "p1", "status")).toBe("ok");
  });

  it("reads field from array output data (first element)", () => {
    const cells: WorkbookCell[] = [
      {
        id: "p1",
        type: "protocol",
        isCollapsed: false,
        payload: { protocolId: "11111111-1111-1111-1111-111111111111", version: 1 },
      },
      makeOutputCell("o1", "p1", [
        { phi2: 0.75, spad: 30 },
        { phi2: 0.8, spad: 35 },
      ]),
    ];
    expect(resolveConditionValue(cells, "p1", "phi2")).toBe(0.75);
    expect(resolveConditionValue(cells, "p1", "spad")).toBe(30);
  });

  it("returns undefined if output has no data", () => {
    const cells: WorkbookCell[] = [
      {
        id: "p1",
        type: "protocol",
        isCollapsed: false,
        payload: { protocolId: "11111111-1111-1111-1111-111111111111", version: 1 },
      },
      makeOutputCell("o1", "p1", undefined),
    ];
    expect(resolveConditionValue(cells, "p1", "x")).toBeUndefined();
  });
});

describe("evaluatePathConditions", () => {
  const baseCells: WorkbookCell[] = [
    {
      id: "p1",
      type: "protocol",
      isCollapsed: false,
      payload: { protocolId: "11111111-1111-1111-1111-111111111111", version: 1 },
    },
    makeOutputCell("o1", "p1", { value: 42, status: "pass" }),
  ];

  it("returns false for empty conditions", () => {
    const path = { id: "path1", label: "P", color: "", conditions: [] };
    expect(evaluatePathConditions(path, baseCells)).toBe(false);
  });

  it("eq operator - numeric match", () => {
    const path = {
      id: "path1",
      label: "P",
      color: "",
      conditions: [
        { id: "c1", sourceCellId: "p1", field: "value", operator: "eq" as const, value: "42" },
      ],
    };
    expect(evaluatePathConditions(path, baseCells)).toBe(true);
  });

  it("eq operator - string match", () => {
    const path = {
      id: "path1",
      label: "P",
      color: "",
      conditions: [
        { id: "c1", sourceCellId: "p1", field: "status", operator: "eq" as const, value: "pass" },
      ],
    };
    expect(evaluatePathConditions(path, baseCells)).toBe(true);
  });

  it("neq operator", () => {
    const path = {
      id: "path1",
      label: "P",
      color: "",
      conditions: [
        { id: "c1", sourceCellId: "p1", field: "value", operator: "neq" as const, value: "0" },
      ],
    };
    expect(evaluatePathConditions(path, baseCells)).toBe(true);
  });

  it("gt operator", () => {
    const path = {
      id: "path1",
      label: "P",
      color: "",
      conditions: [
        { id: "c1", sourceCellId: "p1", field: "value", operator: "gt" as const, value: "40" },
      ],
    };
    expect(evaluatePathConditions(path, baseCells)).toBe(true);
  });

  it("lt operator", () => {
    const path = {
      id: "path1",
      label: "P",
      color: "",
      conditions: [
        { id: "c1", sourceCellId: "p1", field: "value", operator: "lt" as const, value: "50" },
      ],
    };
    expect(evaluatePathConditions(path, baseCells)).toBe(true);
  });

  it("gte operator - equal", () => {
    const path = {
      id: "path1",
      label: "P",
      color: "",
      conditions: [
        { id: "c1", sourceCellId: "p1", field: "value", operator: "gte" as const, value: "42" },
      ],
    };
    expect(evaluatePathConditions(path, baseCells)).toBe(true);
  });

  it("lte operator - less", () => {
    const path = {
      id: "path1",
      label: "P",
      color: "",
      conditions: [
        { id: "c1", sourceCellId: "p1", field: "value", operator: "lte" as const, value: "42" },
      ],
    };
    expect(evaluatePathConditions(path, baseCells)).toBe(true);
  });

  it("AND logic - all must pass", () => {
    const path = {
      id: "path1",
      label: "P",
      color: "",
      conditions: [
        { id: "c1", sourceCellId: "p1", field: "value", operator: "gt" as const, value: "40" },
        { id: "c2", sourceCellId: "p1", field: "status", operator: "eq" as const, value: "pass" },
      ],
    };
    expect(evaluatePathConditions(path, baseCells)).toBe(true);
  });

  it("AND logic - one fails", () => {
    const path = {
      id: "path1",
      label: "P",
      color: "",
      conditions: [
        { id: "c1", sourceCellId: "p1", field: "value", operator: "gt" as const, value: "40" },
        { id: "c2", sourceCellId: "p1", field: "status", operator: "eq" as const, value: "fail" },
      ],
    };
    expect(evaluatePathConditions(path, baseCells)).toBe(false);
  });

  it("returns false if source cell not found", () => {
    const path = {
      id: "path1",
      label: "P",
      color: "",
      conditions: [
        { id: "c1", sourceCellId: "missing", field: "x", operator: "eq" as const, value: "1" },
      ],
    };
    expect(evaluatePathConditions(path, baseCells)).toBe(false);
  });

  it("evaluates question answer against condition", () => {
    const cells: WorkbookCell[] = [makeQuestionCell("q1", "Yes")];
    const path = {
      id: "path1",
      label: "P",
      color: "",
      conditions: [
        { id: "c1", sourceCellId: "q1", field: "", operator: "eq" as const, value: "Yes" },
      ],
    };
    expect(evaluatePathConditions(path, cells)).toBe(true);
  });
});

describe("evaluateBranch", () => {
  const cells: WorkbookCell[] = [
    {
      id: "p1",
      type: "protocol",
      isCollapsed: false,
      payload: { protocolId: "11111111-1111-1111-1111-111111111111", version: 1 },
    },
    makeOutputCell("o1", "p1", { value: 42 }),
  ];

  it("returns the first matching path", () => {
    const branch = makeBranchCell({
      id: "b1",
      paths: [
        {
          id: "pathA",
          label: "A",
          color: "",
          conditions: [
            { id: "c1", sourceCellId: "p1", field: "value", operator: "gt", value: "100" },
          ],
        },
        {
          id: "pathB",
          label: "B",
          color: "",
          conditions: [
            { id: "c2", sourceCellId: "p1", field: "value", operator: "eq", value: "42" },
          ],
        },
      ],
    });

    const result = evaluateBranch(branch, cells);
    expect(result?.id).toBe("pathB");
  });

  it("returns defaultPath when no path matches", () => {
    const branch = makeBranchCell({
      id: "b1",
      defaultPathId: "pathDefault",
      paths: [
        {
          id: "pathA",
          label: "A",
          color: "",
          conditions: [
            { id: "c1", sourceCellId: "p1", field: "value", operator: "gt", value: "100" },
          ],
        },
        {
          id: "pathDefault",
          label: "Default",
          color: "",
          conditions: [
            { id: "c2", sourceCellId: "p1", field: "value", operator: "gt", value: "200" },
          ],
        },
      ],
    });

    const result = evaluateBranch(branch, cells);
    expect(result?.id).toBe("pathDefault");
  });

  it("returns undefined when no path matches and no default", () => {
    const branch = makeBranchCell({
      id: "b1",
      paths: [
        {
          id: "pathA",
          label: "A",
          color: "",
          conditions: [
            { id: "c1", sourceCellId: "p1", field: "value", operator: "gt", value: "100" },
          ],
        },
      ],
    });

    const result = evaluateBranch(branch, cells);
    expect(result).toBeUndefined();
  });

  it("first matching path wins (short-circuit)", () => {
    const branch = makeBranchCell({
      id: "b1",
      paths: [
        {
          id: "pathA",
          label: "A",
          color: "",
          conditions: [
            { id: "c1", sourceCellId: "p1", field: "value", operator: "gt", value: "0" },
          ],
        },
        {
          id: "pathB",
          label: "B",
          color: "",
          conditions: [
            { id: "c2", sourceCellId: "p1", field: "value", operator: "eq", value: "42" },
          ],
        },
      ],
    });

    const result = evaluateBranch(branch, cells);
    expect(result?.id).toBe("pathA");
  });
});

describe("validateBranchCell", () => {
  it("returns error when branch has no paths", () => {
    const cell = makeBranchCell({ id: "b1", paths: [] });
    const errors = validateBranchCell(cell);
    expect(errors).toEqual(["Branch has no paths"]);
  });

  it("returns error when a path has no conditions", () => {
    const cell = makeBranchCell({
      id: "b1",
      paths: [{ id: "p1", label: "Path 1", color: "", conditions: [] }],
    });
    const errors = validateBranchCell(cell);
    expect(errors).toEqual(["Path 1: no conditions defined"]);
  });

  it("returns error for missing source cell", () => {
    const cell = makeBranchCell({
      id: "b1",
      paths: [
        {
          id: "p1",
          label: "Path 1",
          color: "",
          conditions: [{ id: "c1", sourceCellId: "", field: "x", operator: "eq", value: "1" }],
        },
      ],
    });
    const errors = validateBranchCell(cell);
    expect(errors).toEqual(["Path 1, condition 1: no source cell selected"]);
  });

  it("returns error for missing field", () => {
    const cell = makeBranchCell({
      id: "b1",
      paths: [
        {
          id: "p1",
          label: "Path 1",
          color: "",
          conditions: [{ id: "c1", sourceCellId: "s1", field: "", operator: "eq", value: "1" }],
        },
      ],
    });
    const errors = validateBranchCell(cell);
    expect(errors).toEqual(["Path 1, condition 1: no field selected"]);
  });

  it("returns error for missing value", () => {
    const cell = makeBranchCell({
      id: "b1",
      paths: [
        {
          id: "p1",
          label: "Path 1",
          color: "",
          conditions: [{ id: "c1", sourceCellId: "s1", field: "x", operator: "eq", value: "" }],
        },
      ],
    });
    const errors = validateBranchCell(cell);
    expect(errors).toEqual(["Path 1, condition 1: no value specified"]);
  });

  it("allows value of '0'", () => {
    const cell = makeBranchCell({
      id: "b1",
      paths: [
        {
          id: "p1",
          label: "Path 1",
          color: "",
          conditions: [{ id: "c1", sourceCellId: "s1", field: "x", operator: "eq", value: "0" }],
        },
      ],
    });
    const errors = validateBranchCell(cell);
    expect(errors).toHaveLength(0);
  });

  it("returns multiple errors for multiple bad conditions", () => {
    const cell = makeBranchCell({
      id: "b1",
      paths: [
        {
          id: "p1",
          label: "Path 1",
          color: "",
          conditions: [
            { id: "c1", sourceCellId: "", field: "", operator: "eq", value: "" },
            { id: "c2", sourceCellId: "s1", field: "", operator: "eq", value: "ok" },
          ],
        },
      ],
    });
    const errors = validateBranchCell(cell);
    expect(errors).toContain("Path 1, condition 1: no source cell selected");
    expect(errors).toContain("Path 1, condition 1: no field selected");
    expect(errors).toContain("Path 1, condition 1: no value specified");
    expect(errors).toContain("Path 1, condition 2: no field selected");
    expect(errors).toHaveLength(4);
  });

  it("returns no errors for fully configured cell", () => {
    const cell = makeBranchCell({
      id: "b1",
      paths: [
        {
          id: "p1",
          label: "Path 1",
          color: "",
          conditions: [
            { id: "c1", sourceCellId: "s1", field: "answer", operator: "eq", value: "yes" },
          ],
        },
      ],
    });
    const errors = validateBranchCell(cell);
    expect(errors).toHaveLength(0);
  });

  it("uses 'Unnamed path' when label is empty", () => {
    const cell = makeBranchCell({
      id: "b1",
      paths: [
        {
          id: "p1",
          label: "",
          color: "",
          conditions: [{ id: "c1", sourceCellId: "", field: "x", operator: "eq", value: "1" }],
        },
      ],
    });
    const errors = validateBranchCell(cell);
    expect(errors[0]).toMatch(/^Unnamed path/);
  });
});
