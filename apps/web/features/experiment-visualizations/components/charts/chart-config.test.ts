import { describe, expect, it } from "vitest";

import { defaultAxisTypeFor, narrowChartConfig } from "./chart-config";

describe("narrowChartConfig", () => {
  it("returns the visualization's config when present", () => {
    const config = { colorMode: "categorical", barmode: "stack" };
    expect(narrowChartConfig({ config })).toEqual(config);
  });

  it("returns an empty config when missing", () => {
    expect(narrowChartConfig({})).toEqual({});
  });

  it("preserves the same object reference (no defensive copy)", () => {
    const config = { colorMode: "continuous" as const };
    expect(narrowChartConfig({ config })).toBe(config);
  });
});

describe("defaultAxisTypeFor", () => {
  it("picks 'date' for temporal column types", () => {
    expect(defaultAxisTypeFor("TIMESTAMP")).toBe("date");
    expect(defaultAxisTypeFor("DATE")).toBe("date");
  });

  it("picks 'category' for string column types", () => {
    expect(defaultAxisTypeFor("STRING")).toBe("category");
  });

  it("picks 'category' for boolean column types", () => {
    expect(defaultAxisTypeFor("BOOLEAN")).toBe("category");
  });

  it("picks 'linear' for numeric column types", () => {
    expect(defaultAxisTypeFor("INT")).toBe("linear");
    expect(defaultAxisTypeFor("DOUBLE")).toBe("linear");
    expect(defaultAxisTypeFor("BIGINT")).toBe("linear");
  });

  it("picks 'linear' for an undefined column type", () => {
    expect(defaultAxisTypeFor(undefined)).toBe("linear");
  });

  it("picks 'linear' for an unrecognised type string", () => {
    expect(defaultAxisTypeFor("not-a-type")).toBe("linear");
  });
});
