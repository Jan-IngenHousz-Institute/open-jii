import { describe, expect, it, vi } from "vitest";

import {
  getDefaultChartConfig,
  getDefaultDataConfig,
  getDefaultSeriesColor,
} from "./chart-configurator-util";

describe("getDefaultChartConfig", () => {
  it("returns scatter config with markers, color, and marker settings", () => {
    const config = getDefaultChartConfig("scatter");
    expect(config).toMatchObject({
      title: "",
      xAxisTitle: "",
      xAxisType: "linear",
      yAxisType: "linear",
      yAxisTitle: "",
      showLegend: true,
      showGrid: true,
      useWebGL: false,
      mode: "markers",
      color: ["#3b82f6"],
      marker: {
        size: 6,
        symbol: "circle",
        showscale: true,
        colorscale: "Viridis",
        colorbar: { title: { side: "right", text: "" } },
      },
    });
  });

  it("returns line config with lines mode, line settings, and connectgaps", () => {
    const config = getDefaultChartConfig("line");
    expect(config).toMatchObject({
      mode: "lines",
      color: ["#3b82f6"],
      line: { width: 2, smoothing: 0 },
      connectgaps: true,
    });
    expect(config.marker).toBeUndefined();
  });

  it("returns base defaults only for unknown chart type", () => {
    const config = getDefaultChartConfig("unknown");
    expect(config).toMatchObject({
      title: "",
      showLegend: true,
      showGrid: true,
      useWebGL: false,
    });
    expect(config.mode).toBeUndefined();
    expect(config.marker).toBeUndefined();
    expect(config.line).toBeUndefined();
    expect(config.color).toBeUndefined();
  });

  it.each(["SCATTER", "Line", ""])("treats case-sensitive/empty type %j as unknown", (type) => {
    const config = getDefaultChartConfig(type);
    expect(config.mode).toBeUndefined();
  });

  it.each([
    ["title", ""],
    ["xAxisTitle", ""],
    ["yAxisTitle", ""],
    ["xAxisType", "linear"],
    ["yAxisType", "linear"],
    ["showLegend", true],
    ["showGrid", true],
    ["useWebGL", false],
  ] as const)("base default: %s = %j", (key, value) => {
    expect(getDefaultChartConfig("scatter")[key]).toBe(value);
  });
});

describe("getDefaultSeriesColor", () => {
  it("returns primary blue for index 0", () => {
    expect(getDefaultSeriesColor(0)).toBe("#3b82f6");
  });

  it.each([1, 2, 10, 100, -1])("returns a valid non-primary hex color for index %i", (i) => {
    const color = getDefaultSeriesColor(i);
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
    expect(color).not.toBe("#3b82f6");
  });

  it("generates varying colors for different indices", () => {
    const colors = new Set(Array.from({ length: 10 }, (_, i) => getDefaultSeriesColor(i + 1)));
    expect(colors.size).toBeGreaterThan(1);
  });

  it("pads short hex values to 6 characters", () => {
    const orig = Math.random;
    Math.random = vi.fn(() => 0.000001);
    const color = getDefaultSeriesColor(1);
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
    expect(color).toHaveLength(7);
    Math.random = orig;
  });

  it("consistently returns primary color for index 0", () => {
    expect(getDefaultSeriesColor(0)).toBe("#3b82f6");
    expect(getDefaultSeriesColor(0)).toBe("#3b82f6");
  });
});

describe("getDefaultDataConfig", () => {
  it("returns config with provided table name and x/y data sources", () => {
    expect(getDefaultDataConfig("measurements")).toEqual({
      tableName: "measurements",
      dataSources: [
        { tableName: "measurements", columnName: "", role: "x", alias: "" },
        { tableName: "measurements", columnName: "", role: "y", alias: "" },
      ],
    });
  });

  it.each([undefined, undefined])("returns empty table name when undefined", () => {
    const config = getDefaultDataConfig();
    expect(config.tableName).toBe("");
    expect(config.dataSources).toHaveLength(2);
    expect(config.dataSources[0].role).toBe("x");
    expect(config.dataSources[1].role).toBe("y");
  });

  it("uses provided tableName in all data sources", () => {
    const config = getDefaultDataConfig("example");
    config.dataSources.forEach((ds) => {
      expect(ds.tableName).toBe("example");
      expect(ds.columnName).toBe("");
      expect(ds.alias).toBe("");
    });
  });
});
