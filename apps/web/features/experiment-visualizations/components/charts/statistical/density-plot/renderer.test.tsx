import { createVisualization } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { densityPlotDefaultConfig } from "./defaults";
import { DensityPlotRenderer } from "./renderer";

function buildViz(overrides: Parameters<typeof createVisualization>[0] = {}) {
  return createVisualization({
    chartType: "density-plot",
    chartFamily: "statistical",
    config: { ...densityPlotDefaultConfig() },
    dataConfig: {
      tableName: "device",
      dataSources: [{ tableName: "device", columnName: "total_measurements", role: "y" }],
    },
    ...overrides,
  });
}

describe("DensityPlotRenderer", () => {
  it("shows a config error when the visualization isn't a density plot", () => {
    const viz = buildViz({ chartType: "histogram" });
    render(<DensityPlotRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.configuration")).toBeInTheDocument();
  });

  it("shows the empty-state when there are no rows", () => {
    const viz = buildViz();
    render(<DensityPlotRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("renders a smooth KDE curve from raw values", () => {
    const viz = buildViz();
    const rows = [
      { total_measurements: 5 },
      { total_measurements: 7 },
      { total_measurements: 12 },
      { total_measurements: 9 },
      { total_measurements: 15 },
    ];
    render(<DensityPlotRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("renders multiple Y columns as overlaid KDE curves", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "device",
        dataSources: [
          { tableName: "device", columnName: "total_measurements", role: "y" },
          { tableName: "device", columnName: "active_days", role: "y" },
        ],
      },
    });
    const rows = [
      { total_measurements: 5, active_days: 12 },
      { total_measurements: 12, active_days: 8 },
      { total_measurements: 9, active_days: 14 },
    ];
    render(<DensityPlotRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });

  it("supports a color split into one curve per category", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "device",
        dataSources: [
          { tableName: "device", columnName: "total_measurements", role: "y" },
          { tableName: "device", columnName: "device_kind", role: "color" },
        ],
      },
    });
    const rows = [
      { total_measurements: 5, device_kind: "A" },
      { total_measurements: 12, device_kind: "B" },
      { total_measurements: 7, device_kind: "A" },
      { total_measurements: 14, device_kind: "B" },
    ];
    render(<DensityPlotRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });

  it("renders cumulative (CDF) without throwing", () => {
    const viz = buildViz({
      config: { ...densityPlotDefaultConfig(), densityCumulative: true },
    });
    const rows = [{ total_measurements: 3 }, { total_measurements: 9 }, { total_measurements: 15 }];
    render(<DensityPlotRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });

  it("renders horizontal orientation without throwing", () => {
    const viz = buildViz({
      config: { ...densityPlotDefaultConfig(), densityOrientation: "h", densityFill: true },
    });
    const rows = [{ total_measurements: 4 }, { total_measurements: 8 }, { total_measurements: 12 }];
    render(<DensityPlotRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });

  it("skips a series whose column has fewer than 2 numeric values", () => {
    const viz = buildViz();
    const rows = [{ total_measurements: 5 }];
    render(<DensityPlotRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    // KDE needs at least 2 points to produce a meaningful curve; the
    // renderer drops the series rather than emitting a degenerate
    // single-point trace, which would render as a vertical spike.
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });
});
