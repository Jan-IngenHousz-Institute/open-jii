import { createVisualization } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { violinPlotDefaultConfig } from "./defaults";
import { ViolinPlotRenderer } from "./renderer";

function buildViz(overrides: Parameters<typeof createVisualization>[0] = {}) {
  return createVisualization({
    chartType: "violin-plot",
    chartFamily: "statistical",
    config: { ...violinPlotDefaultConfig() },
    dataConfig: {
      tableName: "device",
      dataSources: [
        { tableName: "device", columnName: "device_kind", role: "x" },
        { tableName: "device", columnName: "total_measurements", role: "y" },
      ],
    },
    ...overrides,
  });
}

describe("ViolinPlotRenderer", () => {
  it("shows a config error when the visualization isn't a violin plot", () => {
    const viz = buildViz({ chartType: "box-plot" });
    render(<ViolinPlotRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.configuration")).toBeInTheDocument();
  });

  it("shows the empty-state when there are no rows", () => {
    const viz = buildViz();
    render(<ViolinPlotRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("renders one violin per X category", () => {
    const viz = buildViz();
    const rows = [
      { device_kind: "A", total_measurements: 5 },
      { device_kind: "A", total_measurements: 7 },
      { device_kind: "B", total_measurements: 12 },
      { device_kind: "B", total_measurements: 14 },
    ];
    render(<ViolinPlotRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("renders without an X column (single violin per Y series)", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "device",
        dataSources: [
          { tableName: "device", columnName: "", role: "x" },
          { tableName: "device", columnName: "total_measurements", role: "y" },
        ],
      },
    });
    const rows = [{ total_measurements: 5 }, { total_measurements: 12 }, { total_measurements: 7 }];
    render(<ViolinPlotRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });

  it("supports a color split into one violin per category per X group", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "device",
        dataSources: [
          { tableName: "device", columnName: "device_kind", role: "x" },
          { tableName: "device", columnName: "total_measurements", role: "y" },
          { tableName: "device", columnName: "country", role: "color" },
        ],
      },
    });
    const rows = [
      { device_kind: "A", total_measurements: 5, country: "US" },
      { device_kind: "A", total_measurements: 7, country: "DE" },
      { device_kind: "B", total_measurements: 12, country: "US" },
    ];
    render(<ViolinPlotRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });

  it("renders horizontal half-violins (negative side) without throwing", () => {
    const viz = buildViz({
      config: {
        ...violinPlotDefaultConfig(),
        violinOrientation: "h",
        violinSide: "negative",
      },
    });
    const rows = [
      { device_kind: "A", total_measurements: 3 },
      { device_kind: "B", total_measurements: 9 },
    ];
    render(<ViolinPlotRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });
});
