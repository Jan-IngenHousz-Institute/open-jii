import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

import type { PlotlyChartConfig } from "../types";
import {
  detectWebGLSupport,
  getRenderer,
  validateDimensions,
  getPlotType,
  createBaseLayout,
  createSubplotLayout,
  create3DLayout,
  createPlotlyConfig,
} from "./utils";

// Mock DOM APIs
Object.defineProperty(window, "WebGLRenderingContext", {
  writable: true,
  value: vi.fn(),
});

Object.defineProperty(window, "WebGL2RenderingContext", {
  writable: true,
  value: vi.fn(),
});

// Mock document.createElement
const mockCanvas = {
  getContext: vi.fn(),
};

Object.defineProperty(document, "createElement", {
  writable: true,
  value: vi.fn(() => mockCanvas),
});

describe("utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("detectWebGLSupport", () => {
    it("returns true when WebGL context is available", () => {
      const mockWebGLContext = {
        constructor: { name: "WebGLRenderingContext" },
      };
      mockCanvas.getContext.mockReturnValue(mockWebGLContext);
      Object.setPrototypeOf(mockWebGLContext, WebGLRenderingContext.prototype);

      const result = detectWebGLSupport();
      expect(result).toBe(true);
      expect(document.createElement).toHaveBeenCalledWith("canvas");
      expect(mockCanvas.getContext).toHaveBeenCalledWith("webgl");
    });

    it("returns true when WebGL2 context is available", () => {
      const mockWebGL2Context = {
        constructor: { name: "WebGL2RenderingContext" },
      };
      mockCanvas.getContext
        .mockReturnValueOnce(null) // webgl
        .mockReturnValueOnce(mockWebGL2Context); // experimental-webgl
      Object.setPrototypeOf(mockWebGL2Context, WebGL2RenderingContext.prototype);

      const result = detectWebGLSupport();
      expect(result).toBe(true);
      expect(mockCanvas.getContext).toHaveBeenCalledWith("webgl");
      expect(mockCanvas.getContext).toHaveBeenCalledWith("experimental-webgl");
    });

    it("returns false when no WebGL context is available", () => {
      mockCanvas.getContext.mockReturnValue(null);

      const result = detectWebGLSupport();
      expect(result).toBe(false);
    });

    it("returns false when context is not WebGL", () => {
      const mockCanvasContext = { constructor: { name: "CanvasRenderingContext2D" } };
      mockCanvas.getContext.mockReturnValue(mockCanvasContext);

      const result = detectWebGLSupport();
      expect(result).toBe(false);
    });

    it("returns false when an error occurs", () => {
      mockCanvas.getContext.mockImplementation(() => {
        throw new Error("WebGL not supported");
      });

      const result = detectWebGLSupport();
      expect(result).toBe(false);
    });
  });

  describe("getRenderer", () => {
    it("returns svg when useWebGL is explicitly false", () => {
      const result = getRenderer(false);
      expect(result).toBe("svg");
    });

    it("returns webgl when useWebGL is true and WebGL is supported", () => {
      const mockWebGLContext = {
        constructor: { name: "WebGLRenderingContext" },
      };
      mockCanvas.getContext.mockReturnValue(mockWebGLContext);
      Object.setPrototypeOf(mockWebGLContext, WebGLRenderingContext.prototype);

      const result = getRenderer(true);
      expect(result).toBe("webgl");
    });

    it("returns svg when useWebGL is true but WebGL is not supported", () => {
      mockCanvas.getContext.mockReturnValue(null);
      const result = getRenderer(true);
      expect(result).toBe("svg");
    });
  });

  describe("validateDimensions", () => {
    it("returns valid dimensions when provided", () => {
      const result = validateDimensions(800, 600);
      expect(result).toEqual({ width: 800, height: 600 });
    });

    it("returns default dimensions for invalid width", () => {
      const result = validateDimensions(NaN, 600);
      expect(result).toEqual({ width: 400, height: 600 });
    });

    it("returns default dimensions for invalid height", () => {
      const result = validateDimensions(800, -1);
      expect(result).toEqual({ width: 800, height: 300 });
    });

    it("returns default dimensions for zero values", () => {
      const result = validateDimensions(0, 0);
      expect(result).toEqual({ width: 400, height: 300 });
    });

    it("returns default dimensions when no parameters provided", () => {
      const result = validateDimensions();
      expect(result).toEqual({ width: 400, height: 300 });
    });

    it("returns default dimensions for non-numeric values", () => {
      const result = validateDimensions("800" as any, "600" as any);
      expect(result).toEqual({ width: 400, height: 300 });
    });
  });

  describe("getPlotType", () => {
    it("returns base type when using svg renderer", () => {
      expect(getPlotType("scatter", "svg")).toBe("scatter");
      expect(getPlotType("bar", "svg")).toBe("bar");
      expect(getPlotType("line", "svg")).toBe("line");
    });

    it("converts to WebGL types when using webgl renderer", () => {
      expect(getPlotType("scatter", "webgl")).toBe("scattergl");
      expect(getPlotType("line", "webgl")).toBe("scattergl");
      expect(getPlotType("heatmap", "webgl")).toBe("heatmapgl");
    });

    it("keeps non-WebGL types unchanged even with webgl renderer", () => {
      expect(getPlotType("bar", "webgl")).toBe("bar");
      expect(getPlotType("histogram", "webgl")).toBe("histogram");
      expect(getPlotType("contour", "webgl")).toBe("contour");
    });

    it("preserves 3D plot types", () => {
      expect(getPlotType("scatter3d", "webgl")).toBe("scatter3d");
      expect(getPlotType("surface", "webgl")).toBe("surface");
      expect(getPlotType("mesh3d", "webgl")).toBe("mesh3d");
    });

    it("returns original type for unknown types", () => {
      expect(getPlotType("custom", "webgl")).toBe("custom");
      expect(getPlotType("unknown", "svg")).toBe("unknown");
    });
  });

  describe("createBaseLayout", () => {
    const baseConfig: PlotlyChartConfig = {
      theme: "light",
    };

    it("creates layout with minimal config", () => {
      const layout = createBaseLayout(baseConfig);

      expect(layout).toMatchObject({
        showlegend: true,
        autosize: true,
        plot_bgcolor: "rgba(0,0,0,0)",
        paper_bgcolor: "#ffffff",
        font: {
          family: "Inter, sans-serif",
          color: "#000000",
          size: 12,
        },
      });
    });

    it("applies dark theme styling", () => {
      const config: PlotlyChartConfig = {
        ...baseConfig,
        theme: "dark",
      };

      const layout = createBaseLayout(config);

      expect(layout.font?.color).toBe("#ffffff");
      expect(layout.paper_bgcolor).toBe("#0f0f0f");
      expect(layout.xaxis?.gridcolor).toBe("rgba(255,255,255,0.1)");
      expect(layout.yaxis?.gridcolor).toBe("rgba(255,255,255,0.1)");
    });

    it("sets title when provided", () => {
      const config: PlotlyChartConfig = {
        ...baseConfig,
        title: "Test Chart",
      };

      const layout = createBaseLayout(config);

      expect(layout.title).toMatchObject({
        text: "Test Chart",
        font: {
          size: 16,
          family: "Inter, sans-serif",
          color: "#000000",
        },
      });
    });

    it("configures axis titles", () => {
      const config: PlotlyChartConfig = {
        ...baseConfig,
        xAxisTitle: "X Axis",
        yAxisTitle: "Y Axis",
      };

      const layout = createBaseLayout(config);

      expect(layout.xaxis?.title).toMatchObject({
        text: "X Axis",
        font: {
          size: 14,
          color: "#000000",
          family: "Inter, sans-serif",
        },
      });

      expect(layout.yaxis?.title).toMatchObject({
        text: "Y Axis",
        font: {
          size: 14,
          color: "#000000",
          family: "Inter, sans-serif",
        },
      });
    });

    it("configures axis types", () => {
      const config: PlotlyChartConfig = {
        ...baseConfig,
        xAxisType: "log",
        yAxisType: "category",
      };

      const layout = createBaseLayout(config);

      expect(layout.xaxis?.type).toBe("log");
      expect(layout.yaxis?.type).toBe("category");
    });

    it("configures multiple Y-axes with titles", () => {
      const config: PlotlyChartConfig = {
        ...baseConfig,
        yAxisTitle: "Primary Axis",
        yAxisTitle2: "Secondary Axis",
        yAxisTitle3: "Tertiary Axis",
        yAxisTitle4: "Quaternary Axis",
      };

      const layout = createBaseLayout(config);

      expect(layout.yaxis?.title).toMatchObject({
        text: "Primary Axis",
      });
      expect(layout.yaxis2?.title).toMatchObject({
        text: "Secondary Axis",
      });
      expect(layout.yaxis3?.title).toMatchObject({
        text: "Tertiary Axis",
      });
      expect(layout.yaxis4?.title).toMatchObject({
        text: "Quaternary Axis",
      });
    });

    it("configures multiple Y-axes with different types", () => {
      const config: PlotlyChartConfig = {
        ...baseConfig,
        yAxisType: "linear",
        yAxisType2: "log",
        yAxisType3: "date",
        yAxisType4: "category",
      };

      const layout = createBaseLayout(config);

      expect(layout.yaxis?.type).toBe("linear");
      expect(layout.yaxis2?.type).toBe("log");
      expect(layout.yaxis3?.type).toBe("date");
      expect(layout.yaxis4?.type).toBe("category");
    });

    it("positions multiple Y-axes correctly", () => {
      const config: PlotlyChartConfig = {
        ...baseConfig,
        yAxisTitle: "Y1",
        yAxisTitle2: "Y2",
        yAxisTitle3: "Y3",
        yAxisTitle4: "Y4",
      };

      const layout = createBaseLayout(config);

      // Primary axis on left
      expect(layout.yaxis?.side).toBe("left");

      // Secondary axis on right, anchored to x
      expect(layout.yaxis2?.side).toBe("right");
      expect(layout.yaxis2?.anchor).toBe("x");
      expect(layout.yaxis2?.overlaying).toBe("y");

      // Tertiary axis on left, free positioning
      expect(layout.yaxis3?.side).toBe("left");
      expect(layout.yaxis3?.anchor).toBe("free");
      expect(layout.yaxis3?.overlaying).toBe("y");
      expect(layout.yaxis3?.position).toBe(0.06);

      // Quaternary axis on right, free positioning
      expect(layout.yaxis4?.side).toBe("right");
      expect(layout.yaxis4?.anchor).toBe("free");
      expect(layout.yaxis4?.overlaying).toBe("y");
      expect(layout.yaxis4?.position).toBe(0.95);
    });

    it("applies custom colors to multiple Y-axes", () => {
      const config: PlotlyChartConfig = {
        ...baseConfig,
        yAxisTitle: "Y1",
        yAxisTitle2: "Y2",
        yAxisTitle3: "Y3",
        yAxisTitle4: "Y4",
        yAxisColor: "#ff0000",
        yAxisColor2: "#00ff00",
        yAxisColor3: "#0000ff",
        yAxisColor4: "#ffff00",
      };

      const layout = createBaseLayout(config);

      expect(layout.yaxis?.title?.font?.color).toBe("#ff0000");
      expect(layout.yaxis?.tickfont?.color).toBe("#ff0000");

      expect(layout.yaxis2?.title?.font?.color).toBe("#00ff00");
      expect(layout.yaxis2?.tickfont?.color).toBe("#00ff00");

      expect(layout.yaxis3?.title?.font?.color).toBe("#0000ff");
      expect(layout.yaxis3?.tickfont?.color).toBe("#0000ff");

      expect(layout.yaxis4?.title?.font?.color).toBe("#ffff00");
      expect(layout.yaxis4?.tickfont?.color).toBe("#ffff00");
    });

    it("adjusts x-axis domain when multiple Y-axes are present", () => {
      const config: PlotlyChartConfig = {
        ...baseConfig,
        yAxisTitle: "Y1",
        yAxisTitle2: "Y2",
        yAxisTitle3: "Y3",
        yAxisTitle4: "Y4",
      };

      const layout = createBaseLayout(config);

      // X-axis domain should be adjusted to make room for left and right axes
      expect(layout.xaxis?.domain).toEqual([0.13, 0.88]);
    });

    it("positions legend based on number of right-side axes", () => {
      const config: PlotlyChartConfig = {
        ...baseConfig,
        yAxisTitle: "Y1",
        yAxisTitle2: "Y2",
        yAxisTitle3: "Y3",
        yAxisTitle4: "Y4",
      };

      const layout = createBaseLayout(config);

      // Legend should be positioned to accommodate right-side axes
      expect(layout.legend?.x).toBe(1.0);
      expect(layout.legend?.xanchor).toBe("left");
    });

    it("disables legend when specified", () => {
      const config: PlotlyChartConfig = {
        ...baseConfig,
        showLegend: false,
      };

      const layout = createBaseLayout(config);

      expect(layout.showlegend).toBe(false);
    });

    it("disables grid when specified", () => {
      const config: PlotlyChartConfig = {
        ...baseConfig,
        showGrid: false,
      };

      const layout = createBaseLayout(config);

      expect(layout.xaxis?.showgrid).toBe(false);
      expect(layout.yaxis?.showgrid).toBe(false);
      expect(layout.xaxis?.gridcolor).toBe("rgba(0,0,0,0)");
      expect(layout.yaxis?.gridcolor).toBe("rgba(0,0,0,0)");
    });

    it("applies custom background color", () => {
      const config: PlotlyChartConfig = {
        ...baseConfig,
        backgroundColor: "#f0f0f0",
      };

      const layout = createBaseLayout(config);

      expect(layout.plot_bgcolor).toBe("#f0f0f0");
      expect(layout.paper_bgcolor).toBe("#f0f0f0");
    });

    it("includes annotations with proper styling", () => {
      const config: PlotlyChartConfig = {
        ...baseConfig,
        annotations: [
          {
            text: "Test annotation",
            x: 1,
            y: 1,
          },
        ],
      };

      const layout = createBaseLayout(config);

      expect(layout.annotations).toHaveLength(1);
      expect(layout.annotations?.[0]).toMatchObject({
        text: "Test annotation",
        x: 1,
        y: 1,
        font: {
          color: "#000000",
          size: 12,
          family: "Inter, sans-serif",
        },
        bgcolor: "rgba(255,255,255,0.8)",
      });
    });

    it("includes shapes", () => {
      const config: PlotlyChartConfig = {
        ...baseConfig,
        shapes: [
          {
            type: "line",
            x0: 0,
            y0: 0,
            x1: 1,
            y1: 1,
          },
        ],
      };

      const layout = createBaseLayout(config);

      expect(layout.shapes).toEqual(config.shapes);
    });

    it("configures interaction modes", () => {
      const config: PlotlyChartConfig = {
        ...baseConfig,
        hoverMode: "x unified",
        dragMode: "pan",
      };

      const layout = createBaseLayout(config);

      expect(layout.hovermode).toBe("x unified");
      expect(layout.dragmode).toBe("pan");
    });

    it("includes fixed dimensions when provided", () => {
      const config: PlotlyChartConfig = {
        ...baseConfig,
        width: 800,
        height: 600,
      };

      const layout = createBaseLayout(config);

      expect(layout.width).toBe(800);
      expect(layout.height).toBe(600);
      expect(layout.autosize).toBe(false);
    });

    it("enables autosize when no dimensions provided", () => {
      const layout = createBaseLayout(baseConfig);

      expect(layout.autosize).toBe(true);
      expect(layout.width).toBeUndefined();
      expect(layout.height).toBeUndefined();
    });

    it("includes animation configuration", () => {
      const config: PlotlyChartConfig = {
        ...baseConfig,
        animation: {
          duration: 750,
          easing: "cubic",
        },
      };

      const layout = createBaseLayout(config);

      expect(layout.transition).toEqual({
        duration: 750,
        easing: "cubic",
      });
    });
  });

  describe("createSubplotLayout", () => {
    const baseConfig: PlotlyChartConfig = {
      theme: "light",
    };

    it("returns base layout when no subplot config", () => {
      const layout = createSubplotLayout(baseConfig);
      const baseLayout = createBaseLayout(baseConfig);

      expect(layout).toEqual(baseLayout);
    });

    it("merges subplot configuration", () => {
      const config: PlotlyChartConfig = {
        ...baseConfig,
        subplot: {
          rows: 2,
          cols: 2,
        },
      };

      const layout = createSubplotLayout(config);
      const baseLayout = createBaseLayout(config);

      expect(layout).toEqual(baseLayout);
    });
  });

  describe("create3DLayout", () => {
    const baseConfig: PlotlyChartConfig = {
      theme: "light",
      xAxisTitle: "X Axis",
      yAxisTitle: "Y Axis",
      zAxisTitle: "Z Axis",
    };

    it("creates 3D layout with scene configuration", () => {
      const layout = create3DLayout(baseConfig);

      expect(layout.scene).toBeDefined();
      expect(layout.scene?.xaxis?.title?.text).toBe("X Axis");
      expect(layout.scene?.yaxis?.title?.text).toBe("Y Axis");
      expect(layout.scene?.zaxis?.title?.text).toBe("Z Axis");
    });

    it("applies dark theme to 3D scene", () => {
      const config: PlotlyChartConfig = {
        ...baseConfig,
        theme: "dark",
      };

      const layout = create3DLayout(config);

      expect(layout.scene?.xaxis?.color).toBe("#ffffff");
      expect(layout.scene?.yaxis?.color).toBe("#ffffff");
      expect(layout.scene?.zaxis?.color).toBe("#ffffff");
      expect(layout.scene?.xaxis?.gridcolor).toBe("rgba(255,255,255,0.1)");
    });

    it("uses default axis titles when not provided", () => {
      const config: PlotlyChartConfig = {
        theme: "light",
      };

      const layout = create3DLayout(config);

      expect(layout.scene?.xaxis?.title?.text).toBe("X Axis");
      expect(layout.scene?.yaxis?.title?.text).toBe("Y Axis");
      expect(layout.scene?.zaxis?.title?.text).toBe("Z Axis");
    });

    it("includes camera configuration", () => {
      const layout = create3DLayout(baseConfig);

      expect(layout.scene?.camera).toEqual({
        eye: { x: 1.25, y: 1.25, z: 1.25 },
      });
    });
  });

  describe("createPlotlyConfig", () => {
    const baseConfig: PlotlyChartConfig = {
      theme: "light",
    };

    it("creates config with default values", () => {
      const config = createPlotlyConfig(baseConfig);

      expect(config).toMatchObject({
        displayModeBar: true,
        responsive: true,
        plotGlPixelRatio: 1,
        staticPlot: false,
        doubleClick: "reset",
        showTips: false,
      });
    });

    it("disables mode bar when specified", () => {
      const chartConfig: PlotlyChartConfig = {
        ...baseConfig,
        showModeBar: false,
      };

      const config = createPlotlyConfig(chartConfig);

      expect(config.displayModeBar).toBe(false);
    });

    it("configures minimal mode bar", () => {
      const chartConfig: PlotlyChartConfig = {
        ...baseConfig,
        modeBarStyle: "minimal",
      };

      const config = createPlotlyConfig(chartConfig);

      expect(config.displayModeBar).toBe(true);
      expect(config.displaylogo).toBe(false);
      expect(config.modeBarButtonsToRemove).toContain("lasso2d");
      expect(config.modeBarButtonsToRemove).toContain("select2d");
    });

    it("configures transparent mode bar", () => {
      const chartConfig: PlotlyChartConfig = {
        ...baseConfig,
        modeBarStyle: "transparent",
      };

      const config = createPlotlyConfig(chartConfig);

      expect(config.displayModeBar).toBe(true);
      expect(config.displaylogo).toBe(false);
      expect(config.modeBarButtonsToRemove).toEqual(["lasso2d", "select2d"]);
    });

    it("configures image export options", () => {
      const chartConfig: PlotlyChartConfig = {
        ...baseConfig,
        downloadFilename: "my-chart",
        imageFormat: "png",
        width: 1000,
        height: 800,
      };

      const config = createPlotlyConfig(chartConfig);

      expect(config.toImageButtonOptions).toMatchObject({
        format: "png",
        filename: "my-chart",
        width: 1000,
        height: 800,
        scale: 1,
      });
    });

    it("validates and corrects dimensions for exports", () => {
      const chartConfig: PlotlyChartConfig = {
        ...baseConfig,
        width: NaN,
        height: -100,
      };

      const config = createPlotlyConfig(chartConfig);

      expect(config.toImageButtonOptions?.width).toBe(400);
      expect(config.toImageButtonOptions?.height).toBe(300);
    });

    it("allows config override", () => {
      const chartConfig: PlotlyChartConfig = {
        ...baseConfig,
        responsive: false,
        staticPlot: true,
      };

      const config = createPlotlyConfig(chartConfig);

      expect(config.responsive).toBe(false);
      expect(config.staticPlot).toBe(true);
    });
  });
});
