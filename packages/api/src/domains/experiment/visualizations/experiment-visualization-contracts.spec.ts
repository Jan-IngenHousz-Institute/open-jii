import { describe, expect, it } from "vitest";

import type {
  ExperimentChartDataConfig,
  ExperimentChartType,
  ExperimentDataColumn,
} from "../experiment.schema";
import { WellKnownColumnTypes } from "../experiment.schema";
import {
  CHART_TYPE_ROLE_CONTRACTS,
  filterColumnsForRole,
  getRoleContract,
  isDataConfigRenderable,
  listRequiredRoles,
  validateDataConfig,
} from "./experiment-visualization-contracts";

// Synthetic chart-type label that the registry doesn't know about. Used
// to exercise the "unregistered" fallbacks (`getRoleContract` undefined,
// `validateDataConfig` UNKNOWN_CHART_TYPE) without naming a real schema
// enum value — every value in the enum has a contract entry now, so we
// have to cast a placeholder to keep these branches under test.
const UNREGISTERED = "__synthetic_unregistered__" as ExperimentChartType;

const baseConfig = (
  dataSources: ExperimentChartDataConfig["dataSources"],
  tableName = "readings",
): ExperimentChartDataConfig => ({ tableName, dataSources });

describe("getRoleContract", () => {
  it("returns the contract for a registered chart type", () => {
    expect(getRoleContract("line")).toEqual(CHART_TYPE_ROLE_CONTRACTS.line);
  });

  it("returns undefined for an unregistered chart type", () => {
    expect(getRoleContract(UNREGISTERED)).toBeUndefined();
  });
});

describe("listRequiredRoles", () => {
  // Line / scatter / bar / area / SPC all made x optional — when omitted
  // the renderer synthesises a row-index X axis. So `y` is the only
  // required role on those charts.
  it("returns required roles in contract order", () => {
    expect(listRequiredRoles("line")).toEqual(["y"]);
  });

  it("excludes optional roles", () => {
    expect(listRequiredRoles("scatter")).toEqual(["y"]);
  });

  it("returns multiple required roles when the chart has them", () => {
    expect(listRequiredRoles("heatmap")).toEqual(["x", "y", "z"]);
  });

  it("returns an empty list for unregistered chart types", () => {
    expect(listRequiredRoles(UNREGISTERED)).toEqual([]);
  });
});

describe("validateDataConfig", () => {
  it("passes when all required roles are configured", () => {
    const result = validateDataConfig(
      "line",
      baseConfig([
        { tableName: "readings", columnName: "time", role: "x" },
        { tableName: "readings", columnName: "ch1", role: "y" },
      ]),
    );
    expect(result).toEqual({ ok: true });
  });

  it("allows multiple sources for a 'many' role", () => {
    const result = validateDataConfig(
      "line",
      baseConfig([
        { tableName: "readings", columnName: "time", role: "x" },
        { tableName: "readings", columnName: "ch1", role: "y" },
        { tableName: "readings", columnName: "ch2", role: "y" },
      ]),
    );
    expect(result).toEqual({ ok: true });
  });

  it("flags MISSING_ROLE when a required role has no source", () => {
    const result = validateDataConfig(
      "line",
      baseConfig([{ tableName: "readings", columnName: "time", role: "x" }]),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_ROLE", role: "y" }),
    );
  });

  it("flags EMPTY_COLUMN when a required role exists but has no column", () => {
    const result = validateDataConfig(
      "line",
      baseConfig([
        { tableName: "readings", columnName: "time", role: "x" },
        { tableName: "readings", columnName: "", role: "y" },
      ]),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "EMPTY_COLUMN", role: "y" }),
    );
  });

  it("flags BAD_CARDINALITY for too many sources on a 'single' role", () => {
    const result = validateDataConfig(
      "line",
      baseConfig([
        { tableName: "readings", columnName: "t1", role: "x" },
        { tableName: "readings", columnName: "t2", role: "x" },
        { tableName: "readings", columnName: "ch1", role: "y" },
      ]),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "BAD_CARDINALITY", role: "x" }),
    );
  });

  it("flags EXTRA_ROLE when the chart does not declare that role", () => {
    const result = validateDataConfig(
      "line",
      baseConfig([
        { tableName: "readings", columnName: "time", role: "x" },
        { tableName: "readings", columnName: "ch1", role: "y" },
        { tableName: "readings", columnName: "lat", role: "lat" },
      ]),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "EXTRA_ROLE", role: "lat" }),
    );
  });

  it("returns UNKNOWN_CHART_TYPE for unregistered chart types", () => {
    const result = validateDataConfig(
      UNREGISTERED,
      baseConfig([{ tableName: "readings", columnName: "x", role: "x" }]),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.code).toBe("UNKNOWN_CHART_TYPE");
  });

  it("treats optional roles as not required when absent", () => {
    const result = validateDataConfig(
      "scatter",
      baseConfig([
        { tableName: "readings", columnName: "x", role: "x" },
        { tableName: "readings", columnName: "y", role: "y" },
      ]),
    );
    expect(result).toEqual({ ok: true });
  });

  it("accepts optional roles when configured", () => {
    const result = validateDataConfig(
      "scatter",
      baseConfig([
        { tableName: "readings", columnName: "x", role: "x" },
        { tableName: "readings", columnName: "y", role: "y" },
        { tableName: "readings", columnName: "category", role: "color" },
      ]),
    );
    expect(result).toEqual({ ok: true });
  });
});

describe("isDataConfigRenderable", () => {
  it("returns true for a satisfied contract", () => {
    expect(
      isDataConfigRenderable(
        "line",
        baseConfig([
          { tableName: "readings", columnName: "time", role: "x" },
          { tableName: "readings", columnName: "ch1", role: "y" },
        ]),
      ),
    ).toBe(true);
  });

  it("returns false for an empty data source list", () => {
    expect(isDataConfigRenderable("line", baseConfig([]))).toBe(false);
  });
});

// New chart types added on this branch have distinct role rules; lock the
// load-bearing ones (required size on bubble, required color on ridge,
// required groupBy on alluvial, single-Y restriction on lollipop / wind-rose).
describe("validateDataConfig — branch-new chart types", () => {
  it("bubble requires x, y, and size", () => {
    const result = validateDataConfig(
      "bubble",
      baseConfig([
        { tableName: "t", columnName: "x", role: "x" },
        { tableName: "t", columnName: "y", role: "y" },
      ]),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_ROLE", role: "size" }),
    );
  });

  it("ridge-plot requires color (the joyplot grouping key)", () => {
    const result = validateDataConfig(
      "ridge-plot",
      baseConfig([{ tableName: "t", columnName: "ch1", role: "y" }]),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_ROLE", role: "color" }),
    );
  });

  it("alluvial requires the groupBy role (sankey stages)", () => {
    const result = validateDataConfig(
      "alluvial",
      baseConfig([{ tableName: "t", columnName: "stage1", role: "value" }]),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_ROLE", role: "groupBy" }),
    );
  });

  it("alluvial accepts many groupBy sources (multi-stage)", () => {
    const result = validateDataConfig(
      "alluvial",
      baseConfig([
        { tableName: "t", columnName: "stage1", role: "groupBy" },
        { tableName: "t", columnName: "stage2", role: "groupBy" },
        { tableName: "t", columnName: "stage3", role: "groupBy" },
      ]),
    );
    expect(result).toEqual({ ok: true });
  });

  it("lollipop restricts Y to a single source", () => {
    const result = validateDataConfig(
      "lollipop",
      baseConfig([
        { tableName: "t", columnName: "cat", role: "x" },
        { tableName: "t", columnName: "v1", role: "y" },
        { tableName: "t", columnName: "v2", role: "y" },
      ]),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "BAD_CARDINALITY", role: "y" }),
    );
  });

  it("pie tolerates `values` being omitted (count-by-label)", () => {
    const result = validateDataConfig(
      "pie",
      baseConfig([{ tableName: "t", columnName: "category", role: "labels" }]),
    );
    expect(result).toEqual({ ok: true });
  });

  it("ternary requires x, y, and z all configured", () => {
    const result = validateDataConfig(
      "ternary",
      baseConfig([
        { tableName: "t", columnName: "a", role: "x" },
        { tableName: "t", columnName: "b", role: "y" },
      ]),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "MISSING_ROLE", role: "z" }),
    );
  });
});

describe("filterColumnsForRole", () => {
  const cols: ExperimentDataColumn[] = [
    { name: "ch1", type_name: "double", type_text: "DOUBLE" },
    { name: "tag", type_name: "string", type_text: "STRING" },
    { name: "ts", type_name: "timestamp", type_text: "TIMESTAMP" },
    { name: "ann", type_name: "array", type_text: WellKnownColumnTypes.ANNOTATIONS },
    { name: "creator", type_name: "struct", type_text: WellKnownColumnTypes.CONTRIBUTOR },
    { name: "raw", type_name: "array", type_text: "ARRAY<INT>" },
  ];

  it("drops complex columns globally even when the role would accept them", () => {
    const result = filterColumnsForRole(cols, "line", "x");
    expect(result.map((c) => c.name)).not.toContain("ann");
    expect(result.map((c) => c.name)).not.toContain("raw");
  });

  it("applies role-specific acceptedKinds (bar Y is numeric only)", () => {
    const result = filterColumnsForRole(cols, "bar", "y").map((c) => c.name);
    expect(result).toContain("ch1");
    expect(result).not.toContain("tag");
    expect(result).not.toContain("ts");
  });

  it("falls back to ANY_PLOTTABLE when the role has no acceptedKinds set", () => {
    // Heatmap X / Y are permissive; only complex types get dropped.
    const result = filterColumnsForRole(cols, "heatmap", "x").map((c) => c.name);
    expect(result).toEqual(expect.arrayContaining(["ch1", "tag", "ts", "creator"]));
    expect(result).not.toContain("ann");
  });

  it("treats CONTRIBUTOR as categorical via the well-known-sortable shortcut", () => {
    // Facet only accepts categorical kinds; CONTRIBUTOR projects through.
    const result = filterColumnsForRole(cols, "line", "facet").map((c) => c.name);
    expect(result).toEqual(["tag", "creator"]);
  });

  it("returns plottable columns when the chart type is unregistered (ANY_PLOTTABLE default)", () => {
    // Reuses the file-level UNREGISTERED placeholder; no contract -> default
    // accepted kinds -> complex still dropped, everything else passes.
    const result = filterColumnsForRole(cols, UNREGISTERED, "y").map((c) => c.name);
    expect(result).toEqual(["ch1", "tag", "ts", "creator"]);
  });
});
