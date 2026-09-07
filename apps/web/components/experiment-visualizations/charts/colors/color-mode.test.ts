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

describe("withResolvedColorMode", () => {
  // Only the colour shelf's column picker stamps `colorMode`, so a config saved
  // before that, or authored through the API, arrives without one.
  it("stamps categorical when a colour column has no mode", () => {
    const result = withResolvedColorMode({}, dataConfig(["x", "y", "color"]));

    expect(result.colorMode).toBe("categorical");
  });

  it("leaves an explicit mode alone", () => {
    for (const mode of ["categorical", "continuous"] as const) {
      const config = { colorMode: mode } as ChartFormConfig;
      expect(withResolvedColorMode(config, dataConfig(["x", "y", "color"]))).toBe(config);
    }
  });

  // Charts that support continuous colour ship `colorMode` in their own
  // defaults, so once those are merged the field is already set and this
  // helper must not downgrade them to categorical.
  it("leaves a continuous default from the chart type alone", () => {
    const result = withResolvedColorMode(
      { colorMode: "continuous" },
      dataConfig(["x", "y", "color"]),
    );

    expect(result.colorMode).toBe("continuous");
  });

  it("adds nothing when no colour column is mapped", () => {
    const config = {} as ChartFormConfig;
    const result = withResolvedColorMode(config, dataConfig(["x", "y"]));

    expect(result).toBe(config);
    expect(result.colorMode).toBeUndefined();
  });

  it("does not mutate the config it is given", () => {
    const config = {} as ChartFormConfig;
    withResolvedColorMode(config, dataConfig(["x", "y", "color"]));

    expect(config.colorMode).toBeUndefined();
  });
});
