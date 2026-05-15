import { createVisualization } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { radarDefaultConfig } from "./defaults";
import { RadarRenderer } from "./renderer";

function buildViz(overrides: Parameters<typeof createVisualization>[0] = {}) {
  return createVisualization({
    chartType: "radar",
    chartFamily: "scientific",
    config: { ...radarDefaultConfig() },
    dataConfig: {
      tableName: "device",
      // Defaults seed `avg` on every Y source: the canonical radar UX
      // is "average per group" rather than "one polygon per raw row,"
      // and `MultiColumnShelf` deliberately doesn't expose an aggregate
      // dropdown so users don't have to think about it.
      dataSources: [
        { tableName: "device", columnName: "leaf_temp", role: "y", aggregate: "avg" },
        { tableName: "device", columnName: "leaf_angle", role: "y", aggregate: "avg" },
        { tableName: "device", columnName: "par", role: "y", aggregate: "avg" },
      ],
    },
    ...overrides,
  });
}

describe("RadarRenderer", () => {
  it("shows a config error when the visualization isn't a radar", () => {
    const viz = buildViz({ chartType: "heatmap" });
    render(<RadarRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.configuration")).toBeInTheDocument();
  });

  it("falls through to the generic empty-state with fewer than 3 axes", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "device",
        dataSources: [
          { tableName: "device", columnName: "leaf_temp", role: "y", aggregate: "avg" },
          { tableName: "device", columnName: "leaf_angle", role: "y", aggregate: "avg" },
        ],
      },
    });
    render(
      <RadarRenderer
        visualization={viz}
        experimentId="exp-1"
        data={[{ leaf_temp_avg_s0: 25, leaf_angle_avg_s1: 45 }]}
      />,
    );
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("falls through to the generic empty-state with no rows", () => {
    const viz = buildViz();
    render(<RadarRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("renders one polygon per group when a color column is set (canonical use case)", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "device",
        dataSources: [
          { tableName: "device", columnName: "leaf_temp", role: "y", aggregate: "avg" },
          { tableName: "device", columnName: "leaf_angle", role: "y", aggregate: "avg" },
          { tableName: "device", columnName: "par", role: "y", aggregate: "avg" },
          { tableName: "device", columnName: "device_id", role: "color" },
        ],
      },
    });
    // Server-aggregated: one row per device with avg-prefixed aliases.
    const rows = [
      {
        device_id: "A",
        leaf_temp_avg_s0: 25.5,
        leaf_angle_avg_s1: 45.2,
        par_avg_s2: 800,
      },
      {
        device_id: "B",
        leaf_temp_avg_s0: 22.1,
        leaf_angle_avg_s1: 50.0,
        par_avg_s2: 750,
      },
    ];
    render(<RadarRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("renders a single overall polygon when no color column is picked", () => {
    // No grouping: SQL collapses every measurement to one row of overall
    // averages, the renderer makes one polygon for that row.
    const viz = buildViz();
    const rows = [{ leaf_temp_avg_s0: 24, leaf_angle_avg_s1: 47, par_avg_s2: 780 }];
    render(<RadarRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });
});
