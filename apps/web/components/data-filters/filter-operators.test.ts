import { describe, expect, it } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { WellKnownColumnTypes } from "@repo/api/domains/experiment/data/experiment-data.schema";

import {
  ALL_OPERATORS,
  classifyFilter,
  coerceOperatorForColumn,
  defaultOperatorForColumn,
  defaultValueForOperator,
  operatorValueShape,
  operatorsForColumn,
  operatorsForKind,
} from "./filter-operators";

const numericColumn: ExperimentDataColumn = {
  name: "value",
  type_name: "DOUBLE",
  type_text: "DOUBLE",
};
const stringColumn: ExperimentDataColumn = {
  name: "label",
  type_name: "STRING",
  type_text: "STRING",
};
const timestampColumn: ExperimentDataColumn = {
  name: "ts",
  type_name: "TIMESTAMP",
  type_text: "TIMESTAMP",
};
const contributorColumn: ExperimentDataColumn = {
  name: "owner",
  type_name: "STRUCT",
  type_text: WellKnownColumnTypes.CONTRIBUTOR,
};
const arrayColumn: ExperimentDataColumn = {
  name: "items",
  type_name: "ARRAY",
  type_text: "ARRAY<STRING>",
};

describe("operatorsForKind", () => {
  it("returns the unknown set when kind is undefined", () => {
    expect(operatorsForKind(undefined)).toEqual(ALL_OPERATORS);
  });

  it("returns numeric ops with arithmetic labels", () => {
    const ops = operatorsForKind("numeric");
    expect(ops.map((o) => o.value)).toEqual([
      "equals",
      "not_equals",
      "greater_than",
      "less_than",
      "greater_than_or_equal",
      "less_than_or_equal",
      "between",
      "in",
    ]);
    expect(ops.find((o) => o.value === "equals")?.label).toBe("=");
  });

  it("returns temporal ops with date-friendly labels", () => {
    const ops = operatorsForKind("temporal");
    expect(ops.find((o) => o.value === "equals")?.label).toBe("is on");
    expect(ops.find((o) => o.value === "greater_than")?.label).toBe("after");
  });

  it("returns categorical ops, including contains and in but no inequalities", () => {
    const ops = operatorsForKind("categorical");
    const values = ops.map((o) => o.value);
    expect(values).toContain("contains");
    expect(values).not.toContain("greater_than");
    expect(values).not.toContain("between");
  });

  it("falls back to unknown ops for complex kind", () => {
    expect(operatorsForKind("complex")).toEqual(ALL_OPERATORS);
  });
});

describe("operatorsForColumn", () => {
  it("derives the kind from the column's type_text", () => {
    expect(operatorsForColumn(numericColumn)).toBe(operatorsForKind("numeric"));
    expect(operatorsForColumn(stringColumn)).toBe(operatorsForKind("categorical"));
    expect(operatorsForColumn(timestampColumn)).toBe(operatorsForKind("temporal"));
  });

  it("treats CONTRIBUTOR struct as categorical", () => {
    expect(operatorsForColumn(contributorColumn)).toBe(operatorsForKind("categorical"));
  });

  it("falls back to unknown ops when column is undefined", () => {
    expect(operatorsForColumn(undefined)).toBe(operatorsForKind(undefined));
  });
});

describe("coerceOperatorForColumn", () => {
  it("keeps the operator when it's allowed for the column", () => {
    expect(coerceOperatorForColumn("contains", stringColumn)).toBe("contains");
  });

  it("falls back to equals when the operator isn't allowed", () => {
    expect(coerceOperatorForColumn("contains", numericColumn)).toBe("equals");
    expect(coerceOperatorForColumn("greater_than", stringColumn)).toBe("equals");
  });
});

describe("operatorValueShape", () => {
  it("maps between to tuple and in to array; everything else is scalar", () => {
    expect(operatorValueShape("between")).toBe("tuple");
    expect(operatorValueShape("in")).toBe("array");
    expect(operatorValueShape("equals")).toBe("scalar");
    expect(operatorValueShape("contains")).toBe("scalar");
  });
});

describe("defaultValueForOperator", () => {
  it("returns an empty array for collection-shaped operators", () => {
    expect(defaultValueForOperator("between")).toEqual([]);
    expect(defaultValueForOperator("in")).toEqual([]);
  });

  it("returns an empty string for scalar operators", () => {
    expect(defaultValueForOperator("equals")).toBe("");
    expect(defaultValueForOperator("contains")).toBe("");
  });
});

describe("defaultOperatorForColumn", () => {
  it("picks between for temporal so the picker opens on a date range", () => {
    expect(defaultOperatorForColumn(timestampColumn)).toBe("between");
  });

  it("picks `in` for categorical so multi-select is the default", () => {
    expect(defaultOperatorForColumn(stringColumn)).toBe("in");
    expect(defaultOperatorForColumn(contributorColumn)).toBe("in");
  });

  it("falls back to equals for numeric and unknown columns", () => {
    expect(defaultOperatorForColumn(numericColumn)).toBe("equals");
    expect(defaultOperatorForColumn(arrayColumn)).toBe("equals");
    expect(defaultOperatorForColumn(undefined)).toBe("equals");
  });
});

describe("classifyFilter", () => {
  const between = (value: unknown) =>
    classifyFilter({ column: "signal", operator: "between", value: value as never });

  it("treats an empty value as unset", () => {
    expect(classifyFilter({ column: "signal", operator: "equals", value: undefined })).toEqual({
      status: "unset",
    });
    expect(classifyFilter({ column: "signal", operator: "equals", value: "" })).toEqual({
      status: "unset",
    });
    expect(classifyFilter({ column: "signal", operator: "in", value: [] })).toEqual({
      status: "unset",
    });
    expect(between([])).toEqual({ status: "unset" });
    expect(between(["", ""])).toEqual({ status: "unset" });
  });

  it("flags a range with only a start as missing its end", () => {
    expect(between([0, ""])).toEqual({ status: "invalid", reason: "rangeMissingEnd" });
    expect(between(["2026-01-01T00:00:00.000Z", ""])).toEqual({
      status: "invalid",
      reason: "rangeMissingEnd",
    });
  });

  it("flags a range with only an end as missing its start", () => {
    expect(between(["", 5])).toEqual({ status: "invalid", reason: "rangeMissingStart" });
  });

  it("flags a range whose start is after its end", () => {
    expect(between([9, 1])).toEqual({ status: "invalid", reason: "rangeReversed" });
    expect(between(["2026-02-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z"])).toEqual({
      status: "invalid",
      reason: "rangeReversed",
    });
  });

  it("never treats text that isn't a date as a reversed range", () => {
    expect(between(["b", "a"])).toMatchObject({ status: "applied" });
  });

  it("applies a complete range, including one of a single point", () => {
    expect(between([1, 9])).toEqual({
      status: "applied",
      filter: { column: "signal", operator: "between", value: [1, 9] },
    });
    expect(between([3, 3])).toMatchObject({ status: "applied" });
  });

  it("flags any other value the schema rejects", () => {
    expect(classifyFilter({ column: "signal", operator: "greater_than", value: "abc" })).toEqual({
      status: "invalid",
      reason: "invalidValue",
    });
  });

  it("applies valid values for operators other than between", () => {
    expect(classifyFilter({ column: "signal", operator: "greater_than", value: 4 })).toEqual({
      status: "applied",
      filter: { column: "signal", operator: "greater_than", value: 4 },
    });
    expect(classifyFilter({ column: "line", operator: "in", value: ["A"] })).toMatchObject({
      status: "applied",
    });
  });
});
