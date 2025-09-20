import { describe, it, expect } from "vitest";

// Import all exports from the index file
import * as ScientificComponents from "./index";

describe("Scientific Charts Index", () => {
  it("should export CarpetPlot component", () => {
    expect(ScientificComponents.CarpetPlot).toBeDefined();
    expect(typeof ScientificComponents.CarpetPlot).toBe("function");
  });

  it("should export ContourPlot component", () => {
    expect(ScientificComponents.ContourPlot).toBeDefined();
    expect(typeof ScientificComponents.ContourPlot).toBe("function");
  });

  it("should export OverlayContour component", () => {
    expect(ScientificComponents.OverlayContour).toBeDefined();
    expect(typeof ScientificComponents.OverlayContour).toBe("function");
  });

  it("should export Heatmap component", () => {
    expect(ScientificComponents.Heatmap).toBeDefined();
    expect(typeof ScientificComponents.Heatmap).toBe("function");
  });

  it("should export CorrelationMatrix component", () => {
    expect(ScientificComponents.CorrelationMatrix).toBeDefined();
    expect(typeof ScientificComponents.CorrelationMatrix).toBe("function");
  });

  it("should export LogPlot component", () => {
    expect(ScientificComponents.LogPlot).toBeDefined();
    expect(typeof ScientificComponents.LogPlot).toBe("function");
  });

  it("should export ParallelCoordinates component", () => {
    expect(ScientificComponents.ParallelCoordinates).toBeDefined();
    expect(typeof ScientificComponents.ParallelCoordinates).toBe("function");
  });

  it("should export ParallelCategories component", () => {
    expect(ScientificComponents.ParallelCategories).toBeDefined();
    expect(typeof ScientificComponents.ParallelCategories).toBe("function");
  });

  it("should export Alluvial component", () => {
    expect(ScientificComponents.Alluvial).toBeDefined();
    expect(typeof ScientificComponents.Alluvial).toBe("function");
  });

  it("should export PolarPlot component", () => {
    expect(ScientificComponents.PolarPlot).toBeDefined();
    expect(typeof ScientificComponents.PolarPlot).toBe("function");
  });

  it("should export RadarPlot component", () => {
    expect(ScientificComponents.RadarPlot).toBeDefined();
    expect(typeof ScientificComponents.RadarPlot).toBe("function");
  });

  it("should export MultiRadar component", () => {
    expect(ScientificComponents.MultiRadar).toBeDefined();
    expect(typeof ScientificComponents.MultiRadar).toBe("function");
  });

  it("should export TernaryPlot component", () => {
    expect(ScientificComponents.TernaryPlot).toBeDefined();
    expect(typeof ScientificComponents.TernaryPlot).toBe("function");
  });

  it("should export TernaryContour component", () => {
    expect(ScientificComponents.TernaryContour).toBeDefined();
    expect(typeof ScientificComponents.TernaryContour).toBe("function");
  });

  it("should export WindRose component", () => {
    expect(ScientificComponents.WindRose).toBeDefined();
    expect(typeof ScientificComponents.WindRose).toBe("function");
  });

  it("should export CarpetContour component", () => {
    expect(ScientificComponents.CarpetContour).toBeDefined();
    expect(typeof ScientificComponents.CarpetContour).toBe("function");
  });

  it("should export component type interfaces", () => {
    // Check if type exports are available (they should be re-exported)
    // Note: In TypeScript, type-only exports won't be available at runtime
    // but we can verify the components themselves exist
    const componentNames = [
      "CarpetPlot",
      "CarpetContour",
      "ContourPlot",
      "OverlayContour",
      "Heatmap",
      "CorrelationMatrix",
      "LogPlot",
      "ParallelCoordinates",
      "ParallelCategories",
      "Alluvial",
      "PolarPlot",
      "RadarPlot",
      "MultiRadar",
      "TernaryPlot",
      "TernaryContour",
      "WindRose",
    ];

    componentNames.forEach((name) => {
      expect(ScientificComponents).toHaveProperty(name);
    });
  });

  it("should have proper module structure", () => {
    const exportedKeys = Object.keys(ScientificComponents);

    // Should have at least the 16 main components
    expect(exportedKeys.length).toBeGreaterThanOrEqual(16);

    // All exports should be functions (React components)
    exportedKeys.forEach((key) => {
      expect(typeof ScientificComponents[key as keyof typeof ScientificComponents]).toBe(
        "function",
      );
    });
  });
});
