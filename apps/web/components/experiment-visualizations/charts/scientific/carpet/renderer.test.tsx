import { createVisualization } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { carpetDefaultConfig } from "./defaults";
import { CarpetRenderer } from "./renderer";

function buildViz(overrides: Parameters<typeof createVisualization>[0] = {}) {
  return createVisualization({
    chartType: "carpet",
    chartFamily: "scientific",
    config: { ...carpetDefaultConfig() },
    dataConfig: {
      tableName: "growth",
      dataSources: [
        { tableName: "growth", columnName: "temp", role: "x" },
        { tableName: "growth", columnName: "co2", role: "y" },
        { tableName: "growth", columnName: "yield", role: "z", aggregate: "avg" },
      ],
    },
    ...overrides,
  });
}

describe("CarpetRenderer", () => {
  it("shows a config error when the visualization isn't a carpet", () => {
    const viz = buildViz({ chartType: "heatmap" });
    render(<CarpetRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.invalidConfiguration")).toBeInTheDocument();
  });

  it("falls through to the generic empty-state when X is missing", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "growth",
        dataSources: [
          { tableName: "growth", columnName: "", role: "x" },
          { tableName: "growth", columnName: "co2", role: "y" },
          { tableName: "growth", columnName: "yield", role: "z", aggregate: "avg" },
        ],
      },
    });
    render(
      <CarpetRenderer
        visualization={viz}
        experimentId="exp-1"
        data={[{ co2: 400, yield_avg_s2: 12 }]}
      />,
    );
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("surfaces the same-column-axes message when X and Y point at the same column", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "growth",
        dataSources: [
          { tableName: "growth", columnName: "temp", role: "x" },
          { tableName: "growth", columnName: "temp", role: "y" },
          { tableName: "growth", columnName: "yield", role: "z", aggregate: "avg" },
        ],
      },
    });
    render(<CarpetRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.heatmapSameColumnAxes")).toBeInTheDocument();
  });

  it("surfaces the single-axis-value message when one axis has < 2 unique values", () => {
    const viz = buildViz();
    const rows = [
      { temp: 20, co2: 400, yield_avg_s2: 12 },
      { temp: 20, co2: 600, yield_avg_s2: 14 },
      { temp: 20, co2: 800, yield_avg_s2: 11 },
    ];
    render(<CarpetRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.getByText("errors.heatmapSingleAxisValue")).toBeInTheDocument();
  });

  it("surfaces the flat-z message when all response values are equal", () => {
    const viz = buildViz();
    const rows = [
      { temp: 20, co2: 400, yield_avg_s2: 10 },
      { temp: 20, co2: 600, yield_avg_s2: 10 },
      { temp: 25, co2: 400, yield_avg_s2: 10 },
      { temp: 25, co2: 600, yield_avg_s2: 10 },
    ];
    render(<CarpetRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.getByText("errors.heatmapFlatZ")).toBeInTheDocument();
  });

  it("renders carpet + contour traces from a complete factor grid", () => {
    const viz = buildViz();
    const rows = [
      { temp: 20, co2: 400, yield_avg_s2: 12 },
      { temp: 20, co2: 600, yield_avg_s2: 14 },
      { temp: 20, co2: 800, yield_avg_s2: 11 },
      { temp: 25, co2: 400, yield_avg_s2: 16 },
      { temp: 25, co2: 600, yield_avg_s2: 18 },
      { temp: 25, co2: 800, yield_avg_s2: 15 },
      { temp: 30, co2: 400, yield_avg_s2: 14 },
      { temp: 30, co2: 600, yield_avg_s2: 17 },
      { temp: 30, co2: 800, yield_avg_s2: 13 },
    ];
    render(<CarpetRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
    expect(screen.queryByText(/heatmap/)).not.toBeInTheDocument();
  });

  it("falls through to the generic empty-state with no rows", () => {
    const viz = buildViz();
    render(<CarpetRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });
});
