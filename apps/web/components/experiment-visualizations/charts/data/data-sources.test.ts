import { describe, expect, it } from "vitest";

import type { DataSourceConfig } from "@repo/api/schemas/experiment.schema";

import { dataSourcesByRole, firstDataSourceByRole, makeDataSource } from "./data-sources";

function ds(role: DataSourceConfig["role"], columnName: string): DataSourceConfig {
  return { tableName: "t", columnName, role };
}

describe("dataSourcesByRole", () => {
  it("returns an empty list when no sources match the role", () => {
    expect(dataSourcesByRole([ds("x", "a")], "y")).toEqual([]);
  });

  it("filters by role and preserves the original index", () => {
    const sources = [ds("x", "t"), ds("y", "v"), ds("color", "g"), ds("y", "w")];
    const ys = dataSourcesByRole(sources, "y");
    expect(ys).toHaveLength(2);
    expect(ys[0].index).toBe(1);
    expect(ys[1].index).toBe(3);
    expect(ys[0].source.columnName).toBe("v");
    expect(ys[1].source.columnName).toBe("w");
  });

  it("returns an empty list when sources is empty", () => {
    expect(dataSourcesByRole([], "x")).toEqual([]);
  });
});

describe("firstDataSourceByRole", () => {
  it("returns undefined when no source has the requested role", () => {
    expect(firstDataSourceByRole([ds("x", "a")], "y")).toBeUndefined();
  });

  it("returns the first match in original order", () => {
    const sources = [ds("y", "v"), ds("y", "w")];
    const first = firstDataSourceByRole(sources, "y");
    expect(first?.index).toBe(0);
    expect(first?.source.columnName).toBe("v");
  });

  it("returns undefined on an empty source list", () => {
    expect(firstDataSourceByRole([], "x")).toBeUndefined();
  });
});

describe("makeDataSource", () => {
  it("produces a draft source with empty columnName and alias", () => {
    expect(makeDataSource("device", "y")).toEqual({
      tableName: "device",
      columnName: "",
      role: "y",
      alias: "",
    });
  });

  it("composes with dataSourcesByRole on a fresh draft", () => {
    const drafts = [makeDataSource("t", "x"), makeDataSource("t", "y"), makeDataSource("t", "y")];
    const ys = dataSourcesByRole(drafts, "y");
    expect(ys).toHaveLength(2);
    expect(ys.every(({ source }) => source.columnName === "")).toBe(true);
  });
});
