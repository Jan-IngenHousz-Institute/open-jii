import { createVisualization } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contourDefaultConfig } from "./defaults";
import { ContourRenderer } from "./renderer";

function buildViz(overrides: Parameters<typeof createVisualization>[0] = {}) {
  return createVisualization({
    chartType: "contour",
    chartFamily: "scientific",
    config: { ...contourDefaultConfig() },
    dataConfig: {
      tableName: "device",
      dataSources: [
        { tableName: "device", columnName: "light", role: "x" },
        { tableName: "device", columnName: "temperature", role: "y" },
        { tableName: "device", columnName: "photosynthesis", role: "z" },
      ],
    },
    ...overrides,
  });
}

describe("ContourRenderer", () => {
  it("shows a config error when the visualization isn't a contour", () => {
    const viz = buildViz({ chartType: "heatmap" });
    render(<ContourRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.configuration")).toBeInTheDocument();
  });

  it("shows the empty-state when there are no rows", () => {
    const viz = buildViz();
    render(<ContourRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("shows the empty-state when Z column isn't picked", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "device",
        dataSources: [
          { tableName: "device", columnName: "light", role: "x" },
          { tableName: "device", columnName: "temperature", role: "y" },
          { tableName: "device", columnName: "", role: "z" },
        ],
      },
    });
    const rows = [{ light: 100, temperature: 22 }];
    render(<ContourRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("renders iso-contours from (x, y, z) triples", () => {
    const viz = buildViz();
    const rows = [
      { light: 100, temperature: 20, photosynthesis: 5 },
      { light: 200, temperature: 20, photosynthesis: 8 },
      { light: 100, temperature: 25, photosynthesis: 7 },
      { light: 200, temperature: 25, photosynthesis: 11 },
    ];
    render(<ContourRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("renders pre-aggregated rows from the SQL pipeline (server-side aggregate)", () => {
    // Aggregation runs server-side via the SQL builder. With Z at
    // index 2 and aggregate `avg`, the alias is `photosynthesis_avg_s2`.
    const viz = buildViz({
      dataConfig: {
        tableName: "device",
        dataSources: [
          { tableName: "device", columnName: "light", role: "x" },
          { tableName: "device", columnName: "temperature", role: "y" },
          {
            tableName: "device",
            columnName: "photosynthesis",
            role: "z",
            aggregate: "avg",
          },
        ],
      },
    });
    const rows = [
      { light: 100, temperature: 20, photosynthesis_avg_s2: 5 },
      { light: 200, temperature: 25, photosynthesis_avg_s2: 11 },
    ];
    render(<ContourRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });

  it("respects coloring + iso-line options without throwing", () => {
    const viz = buildViz({
      config: {
        ...contourDefaultConfig(),
        contourColoring: "lines",
        contourShowLabels: true,
        contourNcontours: 12,
      },
    });
    const rows = [
      { light: 100, temperature: 20, photosynthesis: 5 },
      { light: 200, temperature: 25, photosynthesis: 11 },
    ];
    render(<ContourRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });
});
