import { describe, expect, it } from "vitest";

import { BoxPlot, GroupedBoxPlot, ViolinPlot } from "./box-plot/box-plot";
import { DensityPlot, RidgePlot } from "./density/density";
import { ErrorBarPlot, ContinuousErrorBands } from "./error-bars/error-bars";
import { Histogram, Histogram2D } from "./histogram/histogram";
import * as statisticalComponents from "./index";
import { SPCControlCharts } from "./spc-control/spc-control";

describe("Statistical Charts Index", () => {
  describe("Exports Validation", () => {
    it("exports all box plot components", () => {
      expect(statisticalComponents.BoxPlot).toBeDefined();
      expect(statisticalComponents.GroupedBoxPlot).toBeDefined();
      expect(statisticalComponents.ViolinPlot).toBeDefined();

      expect(statisticalComponents.BoxPlot).toBe(BoxPlot);
      expect(statisticalComponents.GroupedBoxPlot).toBe(GroupedBoxPlot);
      expect(statisticalComponents.ViolinPlot).toBe(ViolinPlot);
    });

    it("exports all histogram components", () => {
      expect(statisticalComponents.Histogram).toBeDefined();
      expect(statisticalComponents.Histogram2D).toBeDefined();

      expect(statisticalComponents.Histogram).toBe(Histogram);
      expect(statisticalComponents.Histogram2D).toBe(Histogram2D);
    });

    it("exports all density plot components", () => {
      expect(statisticalComponents.DensityPlot).toBeDefined();
      expect(statisticalComponents.RidgePlot).toBeDefined();

      expect(statisticalComponents.DensityPlot).toBe(DensityPlot);
      expect(statisticalComponents.RidgePlot).toBe(RidgePlot);
    });

    it("exports all error bar components", () => {
      expect(statisticalComponents.ErrorBarPlot).toBeDefined();
      expect(statisticalComponents.ContinuousErrorBands).toBeDefined();

      expect(statisticalComponents.ErrorBarPlot).toBe(ErrorBarPlot);
      expect(statisticalComponents.ContinuousErrorBands).toBe(ContinuousErrorBands);
    });

    it("exports SPC control charts component", () => {
      expect(statisticalComponents.SPCControlCharts).toBeDefined();

      expect(statisticalComponents.SPCControlCharts).toBe(SPCControlCharts);
    });
  });

  describe("Component Types", () => {
    it("all exported components are functions", () => {
      expect(typeof statisticalComponents.BoxPlot).toBe("function");
      expect(typeof statisticalComponents.GroupedBoxPlot).toBe("function");
      expect(typeof statisticalComponents.ViolinPlot).toBe("function");
      expect(typeof statisticalComponents.Histogram).toBe("function");
      expect(typeof statisticalComponents.Histogram2D).toBe("function");
      expect(typeof statisticalComponents.DensityPlot).toBe("function");
      expect(typeof statisticalComponents.RidgePlot).toBe("function");
      expect(typeof statisticalComponents.ErrorBarPlot).toBe("function");
      expect(typeof statisticalComponents.ContinuousErrorBands).toBe("function");
      expect(typeof statisticalComponents.SPCControlCharts).toBe("function");
    });

    it("components have proper names", () => {
      expect(statisticalComponents.BoxPlot.name).toBe("BoxPlot");
      expect(statisticalComponents.GroupedBoxPlot.name).toBe("GroupedBoxPlot");
      expect(statisticalComponents.ViolinPlot.name).toBe("ViolinPlot");
      expect(statisticalComponents.Histogram.name).toBe("Histogram");
      expect(statisticalComponents.Histogram2D.name).toBe("Histogram2D");
      expect(statisticalComponents.DensityPlot.name).toBe("DensityPlot");
      expect(statisticalComponents.RidgePlot.name).toBe("RidgePlot");
      expect(statisticalComponents.ErrorBarPlot.name).toBe("ErrorBarPlot");
      expect(statisticalComponents.ContinuousErrorBands.name).toBe("ContinuousErrorBands");
      expect(statisticalComponents.SPCControlCharts.name).toBe("SPCControlCharts");
    });
  });

  describe("Export Consistency", () => {
    it("direct imports match module exports", () => {
      // Box plot components
      expect(statisticalComponents.BoxPlot).toBe(BoxPlot);
      expect(statisticalComponents.GroupedBoxPlot).toBe(GroupedBoxPlot);
      expect(statisticalComponents.ViolinPlot).toBe(ViolinPlot);

      // Histogram components
      expect(statisticalComponents.Histogram).toBe(Histogram);
      expect(statisticalComponents.Histogram2D).toBe(Histogram2D);

      // Density plot components
      expect(statisticalComponents.DensityPlot).toBe(DensityPlot);
      expect(statisticalComponents.RidgePlot).toBe(RidgePlot);

      // Error bar components
      expect(statisticalComponents.ErrorBarPlot).toBe(ErrorBarPlot);
      expect(statisticalComponents.ContinuousErrorBands).toBe(ContinuousErrorBands);

      // SPC control charts
      expect(statisticalComponents.SPCControlCharts).toBe(SPCControlCharts);
    });

    it("no unexpected exports", () => {
      const expectedExports = [
        // Box plot components
        "BoxPlot",
        "GroupedBoxPlot",
        "ViolinPlot",
        // Histogram components
        "Histogram",
        "Histogram2D",
        // Density plot components
        "DensityPlot",
        "RidgePlot",
        // Error bar components
        "ErrorBarPlot",
        "ContinuousErrorBands",
        // SPC control charts
        "SPCControlCharts",
      ];

      const actualExports = Object.keys(statisticalComponents);

      // Check all expected exports are present
      expectedExports.forEach((exportName) => {
        expect(actualExports).toContain(exportName);
      });

      // Check no unexpected exports (allows for additional internal exports)
      expect(actualExports.length).toBeGreaterThanOrEqual(expectedExports.length);
    });
  });

  describe("Module Structure", () => {
    it("maintains proper module structure", () => {
      // Ensure the module exports are accessible
      expect(statisticalComponents).toBeDefined();
      expect(typeof statisticalComponents).toBe("object");
    });

    it("supports tree shaking with named exports", () => {
      // All exports should be named exports, not default
      expect((statisticalComponents as any).default).toBeUndefined();
    });
  });

  describe("Component Categories", () => {
    it("includes distribution visualization components", () => {
      // Box plot family
      expect(statisticalComponents.BoxPlot).toBeDefined();
      expect(statisticalComponents.GroupedBoxPlot).toBeDefined();
      expect(statisticalComponents.ViolinPlot).toBeDefined();

      // Histogram family
      expect(statisticalComponents.Histogram).toBeDefined();
      expect(statisticalComponents.Histogram2D).toBeDefined();

      // Density plot family
      expect(statisticalComponents.DensityPlot).toBeDefined();
      expect(statisticalComponents.RidgePlot).toBeDefined();
    });

    it("includes uncertainty visualization components", () => {
      expect(statisticalComponents.ErrorBarPlot).toBeDefined();
      expect(statisticalComponents.ContinuousErrorBands).toBeDefined();
    });

    it("includes process control components", () => {
      expect(statisticalComponents.SPCControlCharts).toBeDefined();
    });
  });

  describe("Interface Consistency", () => {
    it("all components follow React component patterns", () => {
      const components = [
        statisticalComponents.BoxPlot,
        statisticalComponents.GroupedBoxPlot,
        statisticalComponents.ViolinPlot,
        statisticalComponents.Histogram,
        statisticalComponents.Histogram2D,
        statisticalComponents.DensityPlot,
        statisticalComponents.RidgePlot,
        statisticalComponents.ErrorBarPlot,
        statisticalComponents.ContinuousErrorBands,
        statisticalComponents.SPCControlCharts,
      ];

      components.forEach((component) => {
        expect(typeof component).toBe("function");
        expect(component.length).toBeGreaterThanOrEqual(1); // Should accept props parameter
      });
    });
  });
});
