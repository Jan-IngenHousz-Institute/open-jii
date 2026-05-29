import { createVisualization } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { densityPlot2DDefaultConfig } from "./defaults";
import { DensityPlot2DRenderer } from "./renderer";

function buildViz(overrides: Parameters<typeof createVisualization>[0] = {}) {
  return createVisualization({
    chartType: "density-plot-2d",
    chartFamily: "statistical",
    config: { ...densityPlot2DDefaultConfig() },
    dataConfig: {
      tableName: "device",
      dataSources: [
        { tableName: "device", columnName: "temperature", role: "x" },
        { tableName: "device", columnName: "humidity", role: "y" },
      ],
    },
    ...overrides,
  });
}

describe("DensityPlot2DRenderer", () => {
  it("shows a config error when the visualization isn't a density-plot-2d", () => {
    const viz = buildViz({ chartType: "histogram-2d" });
    render(<DensityPlot2DRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.configuration")).toBeInTheDocument();
  });

  it("shows the empty-state when there are no rows", () => {
    const viz = buildViz();
    render(<DensityPlot2DRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("shows the empty-state when X column isn't picked", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "device",
        dataSources: [
          { tableName: "device", columnName: "", role: "x" },
          { tableName: "device", columnName: "humidity", role: "y" },
        ],
      },
    });
    const rows = [{ humidity: 0.5 }, { humidity: 0.7 }];
    render(<DensityPlot2DRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("renders scatter + contour overlay from numeric (x, y) pairs", () => {
    const viz = buildViz();
    const rows = [
      { temperature: 22, humidity: 0.45 },
      { temperature: 24, humidity: 0.55 },
      { temperature: 26, humidity: 0.6 },
      { temperature: 25, humidity: 0.5 },
      { temperature: 23, humidity: 0.5 },
    ];
    render(<DensityPlot2DRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("drops rows where either X or Y fails to coerce to a number", () => {
    const viz = buildViz();
    const rows = [
      { temperature: 22, humidity: 0.45 },
      { temperature: "n/a", humidity: 0.55 },
      { temperature: 26, humidity: null },
      { temperature: 25, humidity: 0.5 },
    ];
    render(<DensityPlot2DRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });

  it("renders with filled contour bands without throwing", () => {
    const viz = buildViz({
      config: { ...densityPlot2DDefaultConfig(), density2dContourFill: true },
    });
    const rows = [
      { temperature: 22, humidity: 0.45 },
      { temperature: 24, humidity: 0.55 },
      { temperature: 26, humidity: 0.6 },
    ];
    render(<DensityPlot2DRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });

  it("respects custom marker size + opacity without throwing", () => {
    const viz = buildViz({
      config: {
        ...densityPlot2DDefaultConfig(),
        density2dMarkerSize: 8,
        density2dMarkerOpacity: 0.8,
      },
    });
    const rows = [
      { temperature: 22, humidity: 0.45 },
      { temperature: 24, humidity: 0.55 },
    ];
    render(<DensityPlot2DRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });
});
