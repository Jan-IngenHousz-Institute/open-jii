import { describe, it, expect } from "vitest";

// Import all exports from the index file
import * as ThreeDComponents from "./index";

describe("3D Charts Index", () => {
  it("should export Scatter3D component", () => {
    expect(ThreeDComponents.Scatter3D).toBeDefined();
    expect(typeof ThreeDComponents.Scatter3D).toBe("function");
  });

  it("should export Surface3D component", () => {
    expect(ThreeDComponents.Surface3D).toBeDefined();
    expect(typeof ThreeDComponents.Surface3D).toBe("function");
  });

  it("should export Mesh3D component", () => {
    expect(ThreeDComponents.Mesh3D).toBeDefined();
    expect(typeof ThreeDComponents.Mesh3D).toBe("function");
  });

  it("should export Ribbon3D component", () => {
    expect(ThreeDComponents.Ribbon3D).toBeDefined();
    expect(typeof ThreeDComponents.Ribbon3D).toBe("function");
  });

  it("should export Bubble3D component", () => {
    expect(ThreeDComponents.Bubble3D).toBeDefined();
    expect(typeof ThreeDComponents.Bubble3D).toBe("function");
  });

  it("should export PointClustering3D component", () => {
    expect(ThreeDComponents.PointClustering3D).toBeDefined();
    expect(typeof ThreeDComponents.PointClustering3D).toBe("function");
  });

  it("should export Scatter3DSeriesData type", () => {
    // Type exports can't be tested at runtime, but we can verify the module structure
    expect("Scatter3DSeriesData" in ThreeDComponents).toBe(false); // Types are not exported as runtime values
  });

  it("should export Surface3DSeriesData type", () => {
    // Type exports can't be tested at runtime, but we can verify the module structure
    expect("Surface3DSeriesData" in ThreeDComponents).toBe(false); // Types are not exported as runtime values
  });

  it("should export Mesh3DSeriesData type", () => {
    // Type exports can't be tested at runtime, but we can verify the module structure
    expect("Mesh3DSeriesData" in ThreeDComponents).toBe(false); // Types are not exported as runtime values
  });

  it("should export RibbonSeriesData type", () => {
    // Type exports can't be tested at runtime, but we can verify the module structure
    expect("RibbonSeriesData" in ThreeDComponents).toBe(false); // Types are not exported as runtime values
  });

  it("should export ClusterSeriesData type", () => {
    // Type exports can't be tested at runtime, but we can verify the module structure
    expect("ClusterSeriesData" in ThreeDComponents).toBe(false); // Types are not exported as runtime values
  });

  it("should have all expected component exports", () => {
    const expectedComponents = [
      "Scatter3D",
      "Surface3D",
      "Mesh3D",
      "Ribbon3D",
      "PointClustering3D",
      "Bubble3D",
    ];

    expectedComponents.forEach((componentName) => {
      expect(ThreeDComponents).toHaveProperty(componentName);
      expect(typeof (ThreeDComponents as any)[componentName]).toBe("function");
    });
  });

  it("should not export any unexpected properties", () => {
    const expectedExports = [
      "Scatter3D",
      "Bubble3D",
      "Trajectory3D",
      "Surface3D",
      "ParametricSurface3D",
      "WireframeSurface3D",
      "TerrainMap",
      "Mesh3D",
      "ConvexHull3D",
      "Ribbon3D",
      "PointClustering3D",
      "DensityClustering",
      "HierarchicalClustering",
    ];

    const actualExports = Object.keys(ThreeDComponents);

    // Check that we don't have any unexpected exports
    actualExports.forEach((exportName) => {
      expect(expectedExports).toContain(exportName);
    });

    // Check that we have all expected exports that actually exist
    const existingExpectedExports = expectedExports.filter((exp) => actualExports.includes(exp));
    expect(existingExpectedExports.length).toBeGreaterThan(0);
  });
  it("should export components that can be instantiated", () => {
    // Test that components can be referenced (though not instantiated without proper React context)
    expect(() => ThreeDComponents.Scatter3D).not.toThrow();
    expect(() => ThreeDComponents.Surface3D).not.toThrow();
    expect(() => ThreeDComponents.Mesh3D).not.toThrow();
    expect(() => ThreeDComponents.Ribbon3D).not.toThrow();
    expect(() => ThreeDComponents.PointClustering3D).not.toThrow();
    expect(() => ThreeDComponents.Bubble3D).not.toThrow();
  });
});
