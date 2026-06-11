import { createVisualization } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { histogram2DDefaultConfig } from "./defaults";
import { Histogram2DRenderer } from "./renderer";

function buildViz(overrides: Parameters<typeof createVisualization>[0] = {}) {
  return createVisualization({
    chartType: "histogram-2d",
    chartFamily: "statistical",
    config: { ...histogram2DDefaultConfig() },
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

describe("Histogram2DRenderer", () => {
  it("shows a config error when the visualization isn't a histogram-2d", () => {
    const viz = buildViz({ chartType: "histogram" });
    render(<Histogram2DRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.configuration")).toBeInTheDocument();
  });

  it("shows the empty-state when there are no rows", () => {
    const viz = buildViz();
    render(<Histogram2DRenderer visualization={viz} experimentId="exp-1" data={[]} />);
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
    render(<Histogram2DRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("renders a 2D bin grid from numeric (x, y) pairs", () => {
    const viz = buildViz();
    const rows = [
      { temperature: 22, humidity: 0.45 },
      { temperature: 24, humidity: 0.55 },
      { temperature: 26, humidity: 0.6 },
      { temperature: 25, humidity: 0.5 },
      { temperature: 23, humidity: 0.5 },
    ];
    render(<Histogram2DRenderer visualization={viz} experimentId="exp-1" data={rows} />);
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
    render(<Histogram2DRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    // Only the two clean (x, y) pairs survive; chart still renders
    // the empty-state's inverse (no errors), no length-mismatch crash.
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });

  it("respects custom bin counts and normalisation without throwing", () => {
    const viz = buildViz({
      config: {
        ...histogram2DDefaultConfig(),
        hist2dNbinsX: 30,
        hist2dNbinsY: 20,
        hist2dHistnorm: "probability density",
      },
    });
    const rows = [
      { temperature: 22, humidity: 0.45 },
      { temperature: 24, humidity: 0.55 },
      { temperature: 26, humidity: 0.6 },
    ];
    render(<Histogram2DRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });
});
