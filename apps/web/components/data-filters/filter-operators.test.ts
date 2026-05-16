import { describe, expect, it } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";
import { WellKnownColumnTypes } from "@repo/api/schemas/experiment.schema";

import {
  ALL_OPERATORS,
  coerceOperatorForColumn,
  defaultOperatorForColumn,
  defaultValueForOperator,
  operatorValueShape,
  operatorsForColumn,
  operatorsForKind,
} from "./filter-operators";

const numericColumn: DataColumn = { name: "value", type_name: "DOUBLE", type_text: "DOUBLE" };
const stringColumn: DataColumn = { name: "label", type_name: "STRING", type_text: "STRING" };
const timestampColumn: DataColumn = {
  name: "ts",
  type_name: "TIMESTAMP",
  type_text: "TIMESTAMP",
};
const contributorColumn: DataColumn = {
  name: "owner",
  type_name: "STRUCT",
  type_text: WellKnownColumnTypes.CONTRIBUTOR,
};
const arrayColumn: DataColumn = {
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
