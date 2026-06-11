import { createVisualization } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { ridgePlotDefaultConfig } from "./defaults";
import { RidgePlotRenderer } from "./renderer";

function buildViz(overrides: Parameters<typeof createVisualization>[0] = {}) {
  return createVisualization({
    chartType: "ridge-plot",
    chartFamily: "statistical",
    config: { ...ridgePlotDefaultConfig() },
    dataConfig: {
      tableName: "device",
      dataSources: [
        { tableName: "device", columnName: "total_measurements", role: "y" },
        { tableName: "device", columnName: "device_kind", role: "color" },
      ],
    },
    ...overrides,
  });
}

describe("RidgePlotRenderer", () => {
  it("shows a config error when the visualization isn't a ridge plot", () => {
    const viz = buildViz({ chartType: "histogram" });
    render(<RidgePlotRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.configuration")).toBeInTheDocument();
  });

  it("shows the empty-state when there are no rows", () => {
    const viz = buildViz();
    render(<RidgePlotRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("shows the empty-state when the color column isn't picked", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "device",
        dataSources: [{ tableName: "device", columnName: "total_measurements", role: "y" }],
      },
    });
    const rows = [{ total_measurements: 5 }, { total_measurements: 7 }];
    render(<RidgePlotRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    // No color = no lanes; the chart frame renders the empty-state
    // because the role-required color is missing.
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("renders one lane per category from raw values", () => {
    const viz = buildViz();
    const rows = [
      { total_measurements: 5, device_kind: "A" },
      { total_measurements: 7, device_kind: "A" },
      { total_measurements: 12, device_kind: "B" },
      { total_measurements: 14, device_kind: "B" },
      { total_measurements: 8, device_kind: "C" },
      { total_measurements: 11, device_kind: "C" },
    ];
    render(<RidgePlotRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("renders sorted-by-median order without throwing", () => {
    const viz = buildViz({
      config: { ...ridgePlotDefaultConfig(), ridgeSortOrder: "median" },
    });
    const rows = [
      { total_measurements: 5, device_kind: "A" },
      { total_measurements: 7, device_kind: "A" },
      { total_measurements: 50, device_kind: "B" },
      { total_measurements: 55, device_kind: "B" },
    ];
    render(<RidgePlotRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });

  it("renders without fill (outlines only) when ridgeFill is false", () => {
    const viz = buildViz({
      config: { ...ridgePlotDefaultConfig(), ridgeFill: false },
    });
    const rows = [
      { total_measurements: 5, device_kind: "A" },
      { total_measurements: 7, device_kind: "A" },
      { total_measurements: 12, device_kind: "B" },
      { total_measurements: 14, device_kind: "B" },
    ];
    render(<RidgePlotRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });

  it("skips categories with fewer than 2 numeric values", () => {
    const viz = buildViz();
    // Only category A has enough rows for KDE; B has one, C has zero.
    // The renderer should still produce a chart with just A's lane,
    // not crash on the under-sampled categories.
    const rows = [
      { total_measurements: 5, device_kind: "A" },
      { total_measurements: 7, device_kind: "A" },
      { total_measurements: 9, device_kind: "A" },
      { total_measurements: 12, device_kind: "B" },
      { total_measurements: null, device_kind: "C" },
    ];
    render(<RidgePlotRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });
});
