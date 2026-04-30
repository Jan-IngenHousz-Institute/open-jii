import { describe, it, expect } from "vitest";

import type { DataSourceConfig } from "@repo/api/schemas/experiment.schema";

import {
  DEFAULT_PRIMARY_COLOR,
  dataSourcesByRole,
  firstDataSourceByRole,
  getDefaultSeriesColor,
  makeDataSource,
} from "../form-values";

describe("form-values accessors", () => {
  const sources: DataSourceConfig[] = [
    { tableName: "t", columnName: "time", role: "x" },
    { tableName: "t", columnName: "a", role: "y" },
    { tableName: "t", columnName: "b", role: "y" },
    { tableName: "t", columnName: "c", role: "color" },
  ];

  it("dataSourcesByRole returns indexed entries for all matching role values", () => {
    const ys = dataSourcesByRole(sources, "y");
    expect(ys).toHaveLength(2);
    expect(ys[0]).toEqual({ source: sources[1], index: 1 });
    expect(ys[1]).toEqual({ source: sources[2], index: 2 });
  });

  it("dataSourcesByRole returns an empty array when no entries match", () => {
    expect(dataSourcesByRole(sources, "size")).toEqual([]);
  });

  it("firstDataSourceByRole returns the first match by source order", () => {
    expect(firstDataSourceByRole(sources, "y")).toEqual({ source: sources[1], index: 1 });
  });

  it("firstDataSourceByRole returns undefined when no entries match", () => {
    expect(firstDataSourceByRole(sources, "size")).toBeUndefined();
  });

  it("makeDataSource builds a blank source with the given table and role", () => {
    expect(makeDataSource("readings", "y")).toEqual({
      tableName: "readings",
      columnName: "",
      role: "y",
      alias: "",
    });
  });
});

describe("series colors", () => {
  it("first series uses the primary color", () => {
    expect(getDefaultSeriesColor(0)).toBe(DEFAULT_PRIMARY_COLOR);
  });

  it("subsequent series get a 6-digit hex color", () => {
    expect(getDefaultSeriesColor(1)).toMatch(/^#[0-9a-f]{6}$/);
  });
});
