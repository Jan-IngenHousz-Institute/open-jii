import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

import type { BranchCell, WorkbookCell } from "../domains/workbook/workbook-cells.schema";
import {
  evaluateBranch,
  evaluatePathConditions,
  isDeviceScopedBranch,
  resolveConditionValue,
  validateBranchCell,
  validateDeviceBranch,
} from "./evaluate-branch";
import type { NormalizeMacroInputResult } from "./normalize-macro-input";

interface NormalizationFixture {
  cases: {
    name: string;
    input: unknown;
    expected: NormalizeMacroInputResult;
  }[];
}

const normalizationFixtures = JSON.parse(
  readFileSync(resolve(__dirname, "../../fixtures/macro-input-normalization.json"), "utf8"),
) as NormalizationFixture;
const branchFixtureCases = normalizationFixtures.cases.flatMap(({ name, input, expected }) => {
  if (
    !expected.ok ||
    expected.value === null ||
    typeof expected.value !== "object" ||
    Array.isArray(expected.value)
  ) {
    return [];
  }
  const value = (expected.value as Record<string, unknown>).value;
  return typeof value === "number" || typeof value === "string"
    ? [{ name, input, expectedValue: value }]
    : [];
});

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
    name: `q_${id}`,
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

  it("does not project fields from a direct root array", () => {
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
    expect(resolveConditionValue(cells, "p1", "phi2")).toBeUndefined();
    expect(resolveConditionValue(cells, "p1", "spad")).toBeUndefined();
  });

  it("reads fields from the reserved sample envelope", () => {
    const cells: WorkbookCell[] = [
      {
        id: "p1",
        type: "protocol",
        isCollapsed: false,
        payload: { protocolId: "11111111-1111-1111-1111-111111111111", version: 1 },
      },
      makeOutputCell("o1", "p1", { sample: [{ phi2: 0.8 }] }),
    ];

    expect(resolveConditionValue(cells, "p1", "phi2")).toBe(0.8);
  });

  it.each(branchFixtureCases)(
    "reads the canonical value field for shared fixture $name",
    ({ input, expectedValue }) => {
      const cells: WorkbookCell[] = [
        {
          id: "p1",
          type: "protocol",
          isCollapsed: false,
          payload: { protocolId: "11111111-1111-1111-1111-111111111111", version: 1 },
        },
        makeOutputCell("o1", "p1", input),
      ];

      expect(resolveConditionValue(cells, "p1", "value")).toBe(expectedValue);
    },
  );

  it("propagates an empty-envelope resolver failure", () => {
    const cells: WorkbookCell[] = [
      {
        id: "p1",
        type: "protocol",
        isCollapsed: false,
        payload: { protocolId: "11111111-1111-1111-1111-111111111111", version: 1 },
      },
      makeOutputCell("o1", "p1", { sample: [] }),
    ];

    expect(() => resolveConditionValue(cells, "p1", "phi2")).toThrowError(
      expect.objectContaining({ code: "empty-envelope", source: "sample-envelope" }),
    );
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

describe("$device runtime source", () => {
  const device = {
    family: "multispeq",
    id: "aa:bb:cc:dd",
    name: "MultispeQ",
    firmwareVersion: "2.311",
    index: 0,
  };

  function deviceBranch(overrides?: Partial<BranchCell>): BranchCell {
    return makeBranchCell({
      id: "b1",
      paths: [
        {
          id: "p1",
          label: "MultispeQ path",
          color: "",
          gotoCellId: "prot1",
          conditions: [
            {
              id: "c1",
              sourceCellId: "$device",
              field: "family",
              operator: "eq",
              value: "multispeq",
            },
          ],
        },
        {
          id: "p2",
          label: "Fallback",
          color: "",
          gotoCellId: "cmd1",
          conditions: [
            {
              id: "c2",
              sourceCellId: "$device",
              field: "family",
              operator: "neq",
              value: "multispeq",
            },
          ],
        },
      ],
      defaultPathId: "p2",
      ...overrides,
    });
  }

  it("resolves $device fields from the runtime context", () => {
    expect(resolveConditionValue([], "$device", "family", { device })).toBe("multispeq");
    expect(resolveConditionValue([], "$device", "id", { device })).toBe("aa:bb:cc:dd");
    expect(resolveConditionValue([], "$device", "index", { device })).toBe(0);
    expect(resolveConditionValue([], "$device", "firmwareVersion", { device })).toBe("2.311");
  });

  it("returns undefined for $device without runtime context or for unknown fields", () => {
    expect(resolveConditionValue([], "$device", "family")).toBeUndefined();
    expect(resolveConditionValue([], "$device", "family", {})).toBeUndefined();
    expect(resolveConditionValue([], "$device", "nope", { device })).toBeUndefined();
  });

  it("routes by $device.family and falls to default without a device", () => {
    const cell = deviceBranch();
    expect(evaluateBranch(cell, [], { device })?.id).toBe("p1");
    expect(evaluateBranch(cell, [], { device: { ...device, family: "ambit" } })?.id).toBe("p2");
    expect(evaluateBranch(cell, [])?.id).toBe("p2");
  });

  it("compares $device.index numerically", () => {
    const cell = makeBranchCell({
      id: "b1",
      paths: [
        {
          id: "p1",
          label: "later devices",
          color: "",
          conditions: [
            { id: "c1", sourceCellId: "$device", field: "index", operator: "gte", value: "2" },
          ],
        },
      ],
    });
    expect(evaluateBranch(cell, [], { device: { ...device, index: 3 } })?.id).toBe("p1");
    expect(evaluateBranch(cell, [], { device: { ...device, index: 1 } })).toBeUndefined();
  });

  it("scopes regular output sources to the runtime device", () => {
    const output: WorkbookCell = {
      id: "out-1",
      type: "output",
      isCollapsed: false,
      producedBy: "p1",
      data: { value: 1 },
      deviceResults: [
        { deviceId: "host-a", data: { value: 10 } },
        { deviceId: "host-b", data: { value: 20 } },
      ],
    };
    const producer = { id: "p1", type: "protocol", isCollapsed: false } as WorkbookCell;
    expect(resolveConditionValue([producer, output], "p1", "value", { device })).toBe(1);
    expect(
      resolveConditionValue([producer, output], "p1", "value", {
        device,
        deviceId: "host-b",
      }),
    ).toBe(20);

    const cells: WorkbookCell[] = [makeQuestionCell("q1", "42")];
    expect(resolveConditionValue(cells, "q1", "ignored", { device })).toBe("42");
  });

  it("detects device-scoped branches", () => {
    expect(isDeviceScopedBranch(deviceBranch())).toBe(true);
    const plain = makeBranchCell({
      id: "b2",
      paths: [
        {
          id: "p1",
          label: "",
          color: "",
          conditions: [{ id: "c1", sourceCellId: "q1", field: "x", operator: "eq", value: "1" }],
        },
      ],
    });
    expect(isDeviceScopedBranch(plain)).toBe(false);
  });

  it("validateDeviceBranch requires protocol/command jump targets on every path", () => {
    const cells: WorkbookCell[] = [
      { id: "prot1", type: "protocol", isCollapsed: false } as WorkbookCell,
      makeQuestionCell("q1", "x"),
    ];

    const missingTarget = deviceBranch();
    missingTarget.paths[1].gotoCellId = undefined;
    const errors = validateDeviceBranch(missingTarget, cells);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/Fallback: device-scoped paths must jump/);

    const wrongTarget = deviceBranch();
    wrongTarget.paths[1].gotoCellId = "q1";
    expect(validateDeviceBranch(wrongTarget, cells)[0]).toMatch(
      /jump target must be a protocol or command cell/,
    );

    const okBranch = deviceBranch();
    okBranch.paths[1].gotoCellId = "prot1";
    okBranch.paths[0].gotoCellId = "prot1";
    expect(validateDeviceBranch(okBranch, cells)).toHaveLength(0);

    const plain = makeBranchCell({ id: "b3", paths: [] });
    expect(validateDeviceBranch(plain, cells)).toHaveLength(0);
  });
});
