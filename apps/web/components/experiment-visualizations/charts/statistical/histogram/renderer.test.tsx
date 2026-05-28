import { createVisualization } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { histogramDefaultConfig } from "./defaults";
import { HistogramRenderer } from "./renderer";

function buildViz(overrides: Parameters<typeof createVisualization>[0] = {}) {
  return createVisualization({
    chartType: "histogram",
    chartFamily: "statistical",
    config: { ...histogramDefaultConfig() },
    dataConfig: {
      tableName: "device",
      dataSources: [{ tableName: "device", columnName: "total_measurements", role: "y" }],
    },
    ...overrides,
  });
}

describe("HistogramRenderer", () => {
  it("shows a config error when the visualization isn't a histogram", () => {
    const viz = buildViz({ chartType: "bar" });
    render(<HistogramRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.configuration")).toBeInTheDocument();
  });

  it("shows the empty-state when there are no rows", () => {
    const viz = buildViz();
    render(<HistogramRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("renders the chart frame with binned values", () => {
    const viz = buildViz();
    const rows = [
      { total_measurements: 5 },
      { total_measurements: 12 },
      { total_measurements: 7 },
      { total_measurements: 9 },
    ];
    render(<HistogramRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("renders multiple Y columns as overlaid distributions", () => {
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
    ];
    render(<HistogramRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });

  it("supports a color split for category-overlaid distributions", () => {
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
    ];
    render(<HistogramRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });

  it("renders in horizontal orientation without throwing", () => {
    const viz = buildViz({
      config: { ...histogramDefaultConfig(), histogramOrientation: "h" },
    });
    const rows = [{ total_measurements: 3 }, { total_measurements: 9 }];
    render(<HistogramRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });
});
