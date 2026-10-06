import { describe, expect, it } from "vitest";

import type { ChartFormConfig, ChartFormDataConfig } from "../chart-config";
import { withResolvedColorMode } from "./color-mode";

function dataConfig(roles: string[]): ChartFormDataConfig {
  return {
    tableName: "readings",
    dataSources: roles.map((role) => ({
      tableName: "readings",
      columnName: role === "color" ? "sensor" : role,
      role,
    })),
  } as ChartFormDataConfig;
}

const scatterDefaults: ChartFormConfig = { colorMode: "continuous", showLegend: true };
const lineDefaults: ChartFormConfig = { showLegend: true };

describe("withResolvedColorMode", () => {
  // Only the colour shelf's column picker stamps `colorMode`, so a config saved
  // before that, or authored through the API, arrives without one.
  it("stamps categorical for a categorical-only chart type", () => {
    const result = withResolvedColorMode(lineDefaults, {}, dataConfig(["x", "y", "color"]));

    expect(result.colorMode).toBe("categorical");
  });

  // The scatter default used to fill the gap with "continuous", which drew a
  // text colour column in black. The transform decides from the values.
  it("keeps the mode unset for a chart type with a continuous default", () => {
    const result = withResolvedColorMode(scatterDefaults, {}, dataConfig(["x", "y", "color"]));

    expect(result.colorMode).toBeUndefined();
    expect(result.showLegend).toBe(true);
  });

  it("keeps a persisted mode over the defaults", () => {
    for (const mode of ["categorical", "continuous"] as const) {
      const result = withResolvedColorMode(
        scatterDefaults,
        { colorMode: mode },
        dataConfig(["x", "y", "color"]),
      );
      expect(result.colorMode).toBe(mode);
    }
  });

  it("adds no mode when no colour column is mapped", () => {
    expect(
      withResolvedColorMode(lineDefaults, {}, dataConfig(["x", "y"])).colorMode,
    ).toBeUndefined();
    expect(
      withResolvedColorMode(scatterDefaults, {}, dataConfig(["x", "y"])).colorMode,
    ).toBeUndefined();
  });

  it("does not mutate the configs it is given", () => {
    const persisted = {} as ChartFormConfig;
    withResolvedColorMode(scatterDefaults, persisted, dataConfig(["x", "y", "color"]));

    expect(persisted.colorMode).toBeUndefined();
    expect(scatterDefaults.colorMode).toBe("continuous");
  });
});
