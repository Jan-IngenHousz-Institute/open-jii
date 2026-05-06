import { createVisualization } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { scatterDefaultConfig } from "./defaults";
import { ScatterRenderer } from "./renderer";

function buildViz(overrides: Parameters<typeof createVisualization>[0] = {}) {
  return createVisualization({
    chartType: "scatter",
    chartFamily: "basic",
    config: scatterDefaultConfig(),
    dataConfig: {
      tableName: "readings",
      dataSources: [
        { tableName: "readings", columnName: "time", role: "x" },
        { tableName: "readings", columnName: "temp", role: "y" },
      ],
    },
    ...overrides,
  });
}

describe("ScatterRenderer", () => {
  it("renders a config error when the chart type doesn't match", () => {
    const viz = buildViz({ chartType: "line" });
    render(<ScatterRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.configuration")).toBeInTheDocument();
    expect(screen.getByText("errors.invalidConfiguration")).toBeInTheDocument();
  });

  it("shows the empty-state when there are no rows", () => {
    const viz = buildViz();
    render(<ScatterRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
    expect(screen.getByText("errors.noDataFound")).toBeInTheDocument();
  });

  it("renders the chart frame for a basic continuous scatter (single Y series)", () => {
    const viz = buildViz();
    const rows = [
      { time: 1, temp: 21 },
      { time: 2, temp: 22 },
      { time: 3, temp: 23 },
    ];
    const { container } = render(
      <ScatterRenderer visualization={viz} experimentId="exp-1" data={rows} />,
    );
    // hasRows>0 means we mount the inner ScatterChart, which suspends on
    // react-plotly.js. The Suspense fallback renders. Either way: error
    // and empty placeholders should NOT be visible.
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(container.querySelector(".flex.h-full.w-full.flex-col")).toBeInTheDocument();
  });

  it("handles multiple Y series with categorical color (multi-trace path)", () => {
    const viz = buildViz({
      config: { ...scatterDefaultConfig(), colorMode: "categorical" },
      dataConfig: {
        tableName: "readings",
        dataSources: [
          { tableName: "readings", columnName: "time", role: "x" },
          { tableName: "readings", columnName: "temp", role: "y" },
          { tableName: "readings", columnName: "humidity", role: "y" },
          { tableName: "readings", columnName: "site", role: "color" },
        ],
      },
    });
    const rows = [
      { time: 1, temp: 21, humidity: 40, site: "A" },
      { time: 2, temp: 22, humidity: 41, site: "B" },
      { time: 3, temp: 23, humidity: 42, site: "A" },
    ];
    render(<ScatterRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    // No error/empty branches when both axes are configured and rows present.
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });

  it("handles a continuous color column (single trace with colorscale)", () => {
    const viz = buildViz({
      config: { ...scatterDefaultConfig(), colorMode: "continuous" },
      dataConfig: {
        tableName: "readings",
        dataSources: [
          { tableName: "readings", columnName: "time", role: "x" },
          { tableName: "readings", columnName: "temp", role: "y" },
          { tableName: "readings", columnName: "intensity", role: "color" },
        ],
      },
    });
    const rows = [
      { time: 1, temp: 21, intensity: 0.1 },
      { time: 2, temp: 22, intensity: 0.5 },
    ];
    render(<ScatterRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("renders when only Y is configured (X synthesised from row indices)", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "readings",
        dataSources: [
          { tableName: "readings", columnName: "", role: "x" },
          { tableName: "readings", columnName: "temp", role: "y" },
        ],
      },
    });
    const rows = [{ temp: 21 }, { temp: 22 }];
    render(<ScatterRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });
});
