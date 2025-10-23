import { expect } from "vitest";

describe("Basic Charts Index Exports", () => {
  it("exports all chart components from line-chart", async () => {
    const lineChartModule = await import("./line-chart/line-chart");

    expect(lineChartModule.LineChart).toBeDefined();
    expect(typeof lineChartModule.LineChart).toBe("function");
  });

  it("exports all chart components from scatter-chart", async () => {
    const scatterChartModule = await import("./scatter-chart/scatter-chart");

    expect(scatterChartModule.ScatterChart).toBeDefined();
    expect(scatterChartModule.BubbleChart).toBeDefined();
    expect(typeof scatterChartModule.ScatterChart).toBe("function");
    expect(typeof scatterChartModule.BubbleChart).toBe("function");
  });

  it("exports all chart components from bar-chart", async () => {
    const barChartModule = await import("./bar-chart/bar-chart");

    expect(barChartModule.BarChart).toBeDefined();
    expect(barChartModule.HorizontalBarChart).toBeDefined();
    expect(barChartModule.StackedBarChart).toBeDefined();
    expect(typeof barChartModule.BarChart).toBe("function");
    expect(typeof barChartModule.HorizontalBarChart).toBe("function");
    expect(typeof barChartModule.StackedBarChart).toBe("function");
  });

  it("exports all chart components from pie-chart", async () => {
    const pieChartModule = await import("./pie-chart/pie-chart");

    expect(pieChartModule.PieChart).toBeDefined();
    expect(pieChartModule.DonutChart).toBeDefined();
    expect(typeof pieChartModule.PieChart).toBe("function");
    expect(typeof pieChartModule.DonutChart).toBe("function");
  });

  it("exports all chart components from area-chart", async () => {
    const areaChartModule = await import("./area-chart/area-chart");

    expect(areaChartModule.AreaChart).toBeDefined();
    expect(areaChartModule.StackedAreaChart).toBeDefined();
    expect(typeof areaChartModule.AreaChart).toBe("function");
    expect(typeof areaChartModule.StackedAreaChart).toBe("function");
  });

  it("exports all chart components from dot-plot", async () => {
    const dotPlotModule = await import("./dot-plot/dot-plot");

    expect(dotPlotModule.DotPlot).toBeDefined();
    expect(dotPlotModule.LollipopChart).toBeDefined();
    expect(typeof dotPlotModule.DotPlot).toBe("function");
    expect(typeof dotPlotModule.LollipopChart).toBe("function");
  });

  it("exports components through index barrel export", async () => {
    const indexModule = await import("./index");

    // Test that all main components are exported through the index
    expect(indexModule.LineChart).toBeDefined();
    expect(indexModule.ScatterChart).toBeDefined();
    expect(indexModule.BubbleChart).toBeDefined();
    expect(indexModule.BarChart).toBeDefined();
    expect(indexModule.HorizontalBarChart).toBeDefined();
    expect(indexModule.StackedBarChart).toBeDefined();
    expect(indexModule.PieChart).toBeDefined();
    expect(indexModule.DonutChart).toBeDefined();
    expect(indexModule.AreaChart).toBeDefined();
    expect(indexModule.StackedAreaChart).toBeDefined();
    expect(indexModule.DotPlot).toBeDefined();
    expect(indexModule.LollipopChart).toBeDefined();
  });
});
