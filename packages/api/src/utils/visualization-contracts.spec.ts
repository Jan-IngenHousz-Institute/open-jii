import { describe, expect, it } from "vitest";

import type { ChartDataConfig } from "../schemas/experiment.schema";
import {
  CHART_TYPE_ROLE_CONTRACTS,
  getRoleContract,
  isDataConfigRenderable,
  listRequiredRoles,
  validateDataConfig,
} from "./visualization-contracts";

const baseConfig = (
  dataSources: ChartDataConfig["dataSources"],
  tableName = "readings",
): ChartDataConfig => ({ tableName, dataSources });

describe("getRoleContract", () => {
  it("returns the contract for a registered chart type", () => {
    expect(getRoleContract("line")).toEqual(CHART_TYPE_ROLE_CONTRACTS.line);
  });

  it("returns undefined for an unregistered chart type", () => {
    expect(getRoleContract("alluvial")).toBeUndefined();
  });
});

describe("listRequiredRoles", () => {
  it("returns required roles in contract order", () => {
    expect(listRequiredRoles("line")).toEqual(["x", "y"]);
  });

  it("excludes optional roles", () => {
    expect(listRequiredRoles("scatter")).toEqual(["x", "y"]);
  });

  it("returns an empty list for unregistered chart types", () => {
    expect(listRequiredRoles("alluvial")).toEqual([]);
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
      "alluvial",
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
