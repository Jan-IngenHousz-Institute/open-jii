import { createVisualization } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { polarDefaultConfig } from "./defaults";
import { PolarRenderer } from "./renderer";

function buildViz(overrides: Parameters<typeof createVisualization>[0] = {}) {
  return createVisualization({
    chartType: "polar",
    chartFamily: "scientific",
    config: { ...polarDefaultConfig() },
    dataConfig: {
      tableName: "device",
      dataSources: [
        { tableName: "device", columnName: "bearing", role: "x" },
        { tableName: "device", columnName: "signal", role: "y" },
      ],
    },
    ...overrides,
  });
}

describe("PolarRenderer", () => {
  it("shows a config error when the visualization isn't a polar", () => {
    const viz = buildViz({ chartType: "radar" });
    render(<PolarRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.configuration")).toBeInTheDocument();
  });

  it("falls through to the generic empty-state when X is missing", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "device",
        dataSources: [
          { tableName: "device", columnName: "", role: "x" },
          { tableName: "device", columnName: "signal", role: "y" },
        ],
      },
    });
    render(<PolarRenderer visualization={viz} experimentId="exp-1" data={[{ signal: 100 }]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("falls through to the generic empty-state when no Y series are picked", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "device",
        dataSources: [{ tableName: "device", columnName: "bearing", role: "x" }],
      },
    });
    render(<PolarRenderer visualization={viz} experimentId="exp-1" data={[{ bearing: 0 }]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("falls through to the generic empty-state with no rows", () => {
    const viz = buildViz();
    render(<PolarRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("renders a polar trace from (theta, r) rows", () => {
    const viz = buildViz();
    const rows = [
      { bearing: 0, signal: 50 },
      { bearing: 45, signal: 70 },
      { bearing: 90, signal: 90 },
      { bearing: 135, signal: 60 },
    ];
    render(<PolarRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("splits into one trace per category when a categorical color column is set", () => {
    const viz = buildViz({
      config: { ...polarDefaultConfig(), colorMode: "categorical" },
      dataConfig: {
        tableName: "device",
        dataSources: [
          { tableName: "device", columnName: "bearing", role: "x" },
          { tableName: "device", columnName: "signal", role: "y" },
          { tableName: "device", columnName: "device_id", role: "color" },
        ],
      },
    });
    const rows = [
      { bearing: 0, signal: 50, device_id: "A" },
      { bearing: 90, signal: 70, device_id: "A" },
      { bearing: 0, signal: 60, device_id: "B" },
      { bearing: 90, signal: 80, device_id: "B" },
    ];
    render(<PolarRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });
});
