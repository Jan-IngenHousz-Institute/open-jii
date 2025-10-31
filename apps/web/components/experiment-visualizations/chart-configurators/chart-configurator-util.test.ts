import { describe, expect, it, vi } from "vitest";

import { getDefaultChartConfig, getDefaultSeriesColor } from "./chart-configurator-util";

describe("chart-configurator-util", () => {
  describe("getDefaultChartConfig", () => {
    describe("scatter chart", () => {
      it("should return default config for scatter chart", () => {
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
          colorAxisTitle: "",
          mode: "markers",
          color: ["#3b82f6"],
          marker: {
            size: 6,
            symbol: "circle",
            showscale: true,
            colorscale: "Viridis",
            colorbar: {
              title: {
                side: "right",
              },
            },
          },
        });
      });

      it("should include marker configuration for scatter chart", () => {
        const config = getDefaultChartConfig("scatter");

        expect(config.marker).toBeDefined();
        expect(config.marker?.size).toBe(6);
        expect(config.marker?.symbol).toBe("circle");
        expect(config.marker?.showscale).toBe(true);
        expect(config.marker?.colorscale).toBe("Viridis");
      });

      it("should set mode to markers for scatter chart", () => {
        const config = getDefaultChartConfig("scatter");

        expect(config.mode).toBe("markers");
      });

      it("should include colorbar configuration for scatter chart", () => {
        const config = getDefaultChartConfig("scatter");

        expect(config.marker?.colorbar).toBeDefined();
        expect(config.marker?.colorbar?.title?.side).toBe("right");
      });

      it("should set default color to primary blue for scatter chart", () => {
        const config = getDefaultChartConfig("scatter");

        expect(config.color).toEqual(["#3b82f6"]);
      });
    });

    describe("line chart", () => {
      it("should return default config for line chart", () => {
        const config = getDefaultChartConfig("line");

        expect(config).toMatchObject({
          title: "",
          xAxisTitle: "",
          xAxisType: "linear",
          yAxisType: "linear",
          yAxisTitle: "",
          showLegend: true,
          showGrid: true,
          useWebGL: false,
          mode: "lines",
          color: ["#3b82f6"],
          line: {
            width: 2,
            smoothing: 0,
          },
          connectgaps: true,
        });
      });

      it("should include line configuration for line chart", () => {
        const config = getDefaultChartConfig("line");

        expect(config.line).toBeDefined();
        expect(config.line?.width).toBe(2);
        expect(config.line?.smoothing).toBe(0);
      });

      it("should set mode to lines for line chart", () => {
        const config = getDefaultChartConfig("line");

        expect(config.mode).toBe("lines");
      });

      it("should set connectgaps to true for line chart", () => {
        const config = getDefaultChartConfig("line");

        expect(config.connectgaps).toBe(true);
      });

      it("should set default color to primary blue for line chart", () => {
        const config = getDefaultChartConfig("line");

        expect(config.color).toEqual(["#3b82f6"]);
      });

      it("should not include marker configuration for line chart", () => {
        const config = getDefaultChartConfig("line");

        expect(config.marker).toBeUndefined();
      });

      it("should not include colorAxisTitle for line chart", () => {
        const config = getDefaultChartConfig("line");

        expect(config.colorAxisTitle).toBeUndefined();
      });
    });

    describe("unknown chart type", () => {
      it("should return base defaults for unknown chart type", () => {
        const config = getDefaultChartConfig("unknown");

        expect(config).toMatchObject({
          title: "",
          xAxisTitle: "",
          xAxisType: "linear",
          yAxisType: "linear",
          yAxisTitle: "",
          showLegend: true,
          showGrid: true,
          useWebGL: false,
        });
      });

      it("should not include chart-specific properties for unknown type", () => {
        const config = getDefaultChartConfig("unknown");

        expect(config.mode).toBeUndefined();
        expect(config.marker).toBeUndefined();
        expect(config.line).toBeUndefined();
        expect(config.color).toBeUndefined();
      });
    });

    describe("base defaults", () => {
      it("should set title to empty string", () => {
        const config = getDefaultChartConfig("scatter");

        expect(config.title).toBe("");
      });

      it("should set xAxisTitle to empty string", () => {
        const config = getDefaultChartConfig("line");

        expect(config.xAxisTitle).toBe("");
      });

      it("should set yAxisTitle to empty string", () => {
        const config = getDefaultChartConfig("scatter");

        expect(config.yAxisTitle).toBe("");
      });

      it("should set xAxisType to linear", () => {
        const config = getDefaultChartConfig("line");

        expect(config.xAxisType).toBe("linear");
      });

      it("should set yAxisType to linear", () => {
        const config = getDefaultChartConfig("scatter");

        expect(config.yAxisType).toBe("linear");
      });

      it("should enable legend by default", () => {
        const config = getDefaultChartConfig("line");

        expect(config.showLegend).toBe(true);
      });

      it("should enable grid by default", () => {
        const config = getDefaultChartConfig("scatter");

        expect(config.showGrid).toBe(true);
      });

      it("should disable WebGL by default", () => {
        const config = getDefaultChartConfig("line");

        expect(config.useWebGL).toBe(false);
      });
    });
  });

  describe("getDefaultSeriesColor", () => {
    it("should return primary blue color for first series (index 0)", () => {
      const color = getDefaultSeriesColor(0);

      expect(color).toBe("#3b82f6");
    });

    it("should return random color for second series (index 1)", () => {
      const color = getDefaultSeriesColor(1);

      expect(color).toMatch(/^#[0-9a-f]{6}$/);
      expect(color).not.toBe("#3b82f6");
    });

    it("should return random color for third series (index 2)", () => {
      const color = getDefaultSeriesColor(2);

      expect(color).toMatch(/^#[0-9a-f]{6}$/);
      expect(color).not.toBe("#3b82f6");
    });

    it("should return random color for any index > 0", () => {
      const color = getDefaultSeriesColor(10);

      expect(color).toMatch(/^#[0-9a-f]{6}$/);
      expect(color).not.toBe("#3b82f6");
    });

    it("should return valid hex color format", () => {
      const color1 = getDefaultSeriesColor(0);
      const color2 = getDefaultSeriesColor(1);
      const color3 = getDefaultSeriesColor(5);

      expect(color1).toMatch(/^#[0-9a-f]{6}$/);
      expect(color2).toMatch(/^#[0-9a-f]{6}$/);
      expect(color3).toMatch(/^#[0-9a-f]{6}$/);
    });

    it("should generate different random colors for different series", () => {
      const colors = new Set<string>();

      // Generate 10 colors for series 1-10
      for (let i = 1; i <= 10; i++) {
        colors.add(getDefaultSeriesColor(i));
      }

      // At least some should be different (with very high probability)
      expect(colors.size).toBeGreaterThan(1);
    });

    it("should pad short hex values to 6 characters", () => {
      // Mock Math.random to return a small number that would need padding
      const originalRandom = Math.random;
      Math.random = vi.fn(() => 0.000001);

      const color = getDefaultSeriesColor(1);

      expect(color).toMatch(/^#[0-9a-f]{6}$/);
      expect(color.length).toBe(7); // # + 6 characters

      Math.random = originalRandom;
    });

    it("should handle large series indices", () => {
      const color = getDefaultSeriesColor(100);

      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    });

    it("should consistently return primary color for index 0", () => {
      const color1 = getDefaultSeriesColor(0);
      const color2 = getDefaultSeriesColor(0);
      const color3 = getDefaultSeriesColor(0);

      expect(color1).toBe("#3b82f6");
      expect(color2).toBe("#3b82f6");
      expect(color3).toBe("#3b82f6");
    });
  });

  describe("edge cases", () => {
    it("should handle negative series index", () => {
      const color = getDefaultSeriesColor(-1);

      // Negative index is not 0, so should get random color
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
      expect(color).not.toBe("#3b82f6");
    });

    it("should handle empty string as chart type", () => {
      const config = getDefaultChartConfig("");

      expect(config).toMatchObject({
        title: "",
        xAxisTitle: "",
        xAxisType: "linear",
        yAxisType: "linear",
        yAxisTitle: "",
        showLegend: true,
        showGrid: true,
        useWebGL: false,
      });
    });

    it("should handle case-sensitive chart type", () => {
      const config1 = getDefaultChartConfig("SCATTER");
      const config2 = getDefaultChartConfig("Line");

      // Should return base defaults for non-matching cases
      expect(config1.mode).toBeUndefined();
      expect(config2.mode).toBeUndefined();
    });
  });
});
