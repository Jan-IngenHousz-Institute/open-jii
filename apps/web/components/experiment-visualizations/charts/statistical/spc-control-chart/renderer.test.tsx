import { createVisualization } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { spcDefaultConfig } from "./defaults";
import { SPCRenderer } from "./renderer";

function buildViz(overrides: Parameters<typeof createVisualization>[0] = {}) {
  return createVisualization({
    chartType: "spc-control-chart",
    chartFamily: "statistical",
    config: { ...spcDefaultConfig() },
    dataConfig: {
      tableName: "device",
      dataSources: [
        { tableName: "device", columnName: "timestamp", role: "x" },
        { tableName: "device", columnName: "temperature", role: "y" },
      ],
    },
    ...overrides,
  });
}

describe("SPCRenderer", () => {
  it("shows a config error when the visualization isn't an spc-control-chart", () => {
    const viz = buildViz({ chartType: "histogram" });
    render(<SPCRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.configuration")).toBeInTheDocument();
  });

  it("shows the empty-state when there are no rows", () => {
    const viz = buildViz();
    render(<SPCRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("renders the process walk + control limits from raw values", () => {
    const viz = buildViz();
    const rows = [
      { timestamp: "2024-01-01", temperature: 22.0 },
      { timestamp: "2024-01-02", temperature: 22.4 },
      { timestamp: "2024-01-03", temperature: 21.8 },
      { timestamp: "2024-01-04", temperature: 22.1 },
      { timestamp: "2024-01-05", temperature: 22.3 },
      // Spike: should be flagged as out of control with default 3σ
      // limits (range is 21.8–22.4 in the prior 5 points; 35°C is far
      // outside ±3σ of that).
      { timestamp: "2024-01-06", temperature: 35.0 },
      { timestamp: "2024-01-07", temperature: 22.2 },
    ];
    render(<SPCRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("drops rows with non-numeric Y so mean/std stay finite", () => {
    const viz = buildViz();
    const rows = [
      { timestamp: "2024-01-01", temperature: 22.0 },
      { timestamp: "2024-01-02", temperature: "n/a" },
      { timestamp: "2024-01-03", temperature: null },
      { timestamp: "2024-01-04", temperature: 22.1 },
      { timestamp: "2024-01-05", temperature: 22.3 },
    ];
    render(<SPCRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });

  it("renders without throwing when warning limits are enabled", () => {
    const viz = buildViz({
      config: { ...spcDefaultConfig(), spcShowWarningLimits: true },
    });
    const rows = [
      { timestamp: "2024-01-01", temperature: 22.0 },
      { timestamp: "2024-01-02", temperature: 22.4 },
      { timestamp: "2024-01-03", temperature: 21.8 },
      { timestamp: "2024-01-04", temperature: 22.1 },
    ];
    render(<SPCRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });

  it("renders without throwing when outlier highlighting is disabled", () => {
    const viz = buildViz({
      config: { ...spcDefaultConfig(), spcHighlightOutliers: false },
    });
    const rows = [
      { timestamp: "2024-01-01", temperature: 22.0 },
      { timestamp: "2024-01-02", temperature: 50.0 },
      { timestamp: "2024-01-03", temperature: 22.1 },
    ];
    render(<SPCRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });

  it("shows the empty-state when the Y column is unset", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "device",
        dataSources: [
          { tableName: "device", columnName: "timestamp", role: "x" },
          { tableName: "device", columnName: "", role: "y" },
        ],
      },
    });
    render(
      <SPCRenderer visualization={viz} experimentId="exp-1" data={[{ timestamp: "2024-01-01" }]} />,
    );
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("synthesises a row-index X axis when no X column is configured", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "device",
        dataSources: [
          { tableName: "device", columnName: "", role: "x" },
          { tableName: "device", columnName: "temperature", role: "y" },
        ],
      },
    });
    const rows = [{ temperature: 22.0 }, { temperature: 22.3 }, { temperature: 21.9 }];
    render(<SPCRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("drops rows where the X cell is null when X column is configured", () => {
    const viz = buildViz();
    const rows = [
      { timestamp: "2024-01-01", temperature: 22.0 },
      { timestamp: null, temperature: 22.4 },
      { timestamp: "2024-01-03", temperature: 21.8 },
    ];
    render(<SPCRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });

  it("flags out-of-control points when the spike sits outside the computed limits", () => {
    // 20 stable baseline points + one extreme outlier: the outlier doesn't
    // dominate mean/std enough to widen UCL past itself, so highlight fires.
    const viz = buildViz();
    const rows = [
      ...Array.from({ length: 20 }, (_, i) => ({
        timestamp: `2024-01-${String(i + 1).padStart(2, "0")}`,
        temperature: 22.0 + (i % 2) * 0.1,
      })),
      { timestamp: "2024-02-01", temperature: 50.0 },
    ];
    render(<SPCRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("renders with a custom sigma multiplier", () => {
    const viz = buildViz({
      config: { ...spcDefaultConfig(), spcSigmaMultiplier: 2 },
    });
    const rows = [
      { timestamp: "2024-01-01", temperature: 22.0 },
      { timestamp: "2024-01-02", temperature: 22.4 },
      { timestamp: "2024-01-03", temperature: 21.8 },
      { timestamp: "2024-01-04", temperature: 22.1 },
    ];
    render(<SPCRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });
});
