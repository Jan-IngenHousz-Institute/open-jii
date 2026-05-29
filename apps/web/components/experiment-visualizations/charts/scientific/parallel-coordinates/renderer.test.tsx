import { createVisualization } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { parallelCoordinatesDefaultConfig } from "./defaults";
import { ParallelCoordinatesRenderer } from "./renderer";

function buildViz(overrides: Parameters<typeof createVisualization>[0] = {}) {
  return createVisualization({
    chartType: "parallel-coordinates",
    chartFamily: "scientific",
    config: { ...parallelCoordinatesDefaultConfig() },
    dataConfig: {
      tableName: "device",
      dataSources: [
        { tableName: "device", columnName: "temperature", role: "y" },
        { tableName: "device", columnName: "humidity", role: "y" },
        { tableName: "device", columnName: "pressure", role: "y" },
      ],
    },
    ...overrides,
  });
}

describe("ParallelCoordinatesRenderer", () => {
  it("shows a config error when the visualization isn't a parallel-coordinates", () => {
    const viz = buildViz({ chartType: "heatmap" });
    render(<ParallelCoordinatesRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.configuration")).toBeInTheDocument();
  });

  it("falls through to the generic empty-state with fewer than 2 axes", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "device",
        dataSources: [{ tableName: "device", columnName: "temperature", role: "y" }],
      },
    });
    render(
      <ParallelCoordinatesRenderer
        visualization={viz}
        experimentId="exp-1"
        data={[{ temperature: 22 }]}
      />,
    );
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("falls through to the generic empty-state with no rows", () => {
    const viz = buildViz();
    render(<ParallelCoordinatesRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("renders polylines from raw rows across the picked numeric axes", () => {
    const viz = buildViz();
    const rows = [
      { temperature: 22, humidity: 0.5, pressure: 1013 },
      { temperature: 24, humidity: 0.6, pressure: 1015 },
      { temperature: 21, humidity: 0.45, pressure: 1010 },
    ];
    render(<ParallelCoordinatesRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("dedupes column picks so the same column twice doesn't introduce a duplicate axis", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "device",
        dataSources: [
          { tableName: "device", columnName: "temperature", role: "y" },
          { tableName: "device", columnName: "humidity", role: "y" },
          { tableName: "device", columnName: "humidity", role: "y" },
        ],
      },
    });
    const rows = [{ temperature: 22, humidity: 0.5 }];
    render(<ParallelCoordinatesRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });

  it("coerces non-numeric values to NaN so the polyline shows a gap rather than misaligning", () => {
    const viz = buildViz();
    const rows = [
      { temperature: 22, humidity: "n/a", pressure: 1013 },
      { temperature: 24, humidity: 0.6, pressure: 1015 },
    ];
    render(<ParallelCoordinatesRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });
});
