import { createVisualization } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { heatmapDefaultConfig } from "./defaults";
import { HeatmapRenderer } from "./renderer";

function buildViz(overrides: Parameters<typeof createVisualization>[0] = {}) {
  return createVisualization({
    chartType: "heatmap",
    chartFamily: "scientific",
    config: { ...heatmapDefaultConfig() },
    dataConfig: {
      tableName: "device",
      dataSources: [
        { tableName: "device", columnName: "hour_of_day", role: "x" },
        { tableName: "device", columnName: "device_id", role: "y" },
        { tableName: "device", columnName: "temperature", role: "z" },
      ],
    },
    ...overrides,
  });
}

describe("HeatmapRenderer", () => {
  it("shows a config error when the visualization isn't a heatmap", () => {
    const viz = buildViz({ chartType: "histogram-2d" });
    render(<HeatmapRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.configuration")).toBeInTheDocument();
  });

  it("shows the empty-state when there are no rows", () => {
    const viz = buildViz();
    render(<HeatmapRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("shows the empty-state when Z column isn't picked", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "device",
        dataSources: [
          { tableName: "device", columnName: "hour_of_day", role: "x" },
          { tableName: "device", columnName: "device_id", role: "y" },
          { tableName: "device", columnName: "", role: "z" },
        ],
      },
    });
    const rows = [{ hour_of_day: 1, device_id: "A" }];
    render(<HeatmapRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("renders a matrix from (x, y, z) triples", () => {
    const viz = buildViz();
    const rows = [
      { hour_of_day: 1, device_id: "A", temperature: 20 },
      { hour_of_day: 1, device_id: "B", temperature: 21 },
      { hour_of_day: 2, device_id: "A", temperature: 22 },
      { hour_of_day: 2, device_id: "B", temperature: 23 },
    ];
    render(<HeatmapRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("renders pre-aggregated rows from the SQL pipeline (server-side aggregate)", () => {
    // Aggregation happens server-side now: the SQL builder projects
    // `<column>_<fn>_s<index>` per `aggregateAliasForSource`. The
    // renderer reads that key, not the raw column. With Z source at
    // index 2 and aggregate `avg`, the alias is `temperature_avg_s2`.
    const viz = buildViz({
      dataConfig: {
        tableName: "device",
        dataSources: [
          { tableName: "device", columnName: "hour_of_day", role: "x" },
          { tableName: "device", columnName: "device_id", role: "y" },
          {
            tableName: "device",
            columnName: "temperature",
            role: "z",
            aggregate: "avg",
          },
        ],
      },
    });
    const rows = [
      { hour_of_day: 1, device_id: "A", temperature_avg_s2: 25 },
      { hour_of_day: 2, device_id: "A", temperature_avg_s2: 25 },
    ];
    render(<HeatmapRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("drops rows with non-numeric Z values without dropping the chart", () => {
    const viz = buildViz();
    const rows = [
      { hour_of_day: 1, device_id: "A", temperature: 20 },
      { hour_of_day: 1, device_id: "B", temperature: "n/a" },
      { hour_of_day: 2, device_id: "A", temperature: null },
      { hour_of_day: 2, device_id: "B", temperature: 23 },
    ];
    render(<HeatmapRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });
});
