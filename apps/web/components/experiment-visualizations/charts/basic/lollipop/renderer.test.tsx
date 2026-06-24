import { createVisualization } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { lollipopDefaultConfig } from "./defaults";
import { LollipopRenderer } from "./renderer";

function buildViz(overrides: Parameters<typeof createVisualization>[0] = {}) {
  return createVisualization({
    chartType: "lollipop",
    chartFamily: "basic",
    config: { ...lollipopDefaultConfig() },
    dataConfig: {
      tableName: "harvest",
      dataSources: [
        { tableName: "harvest", columnName: "variety", role: "x" },
        { tableName: "harvest", columnName: "yield", role: "y" },
      ],
    },
    ...overrides,
  });
}

describe("LollipopRenderer", () => {
  it("shows a config error when the visualization isn't a lollipop chart", () => {
    const viz = buildViz({ chartType: "line" });
    render(<LollipopRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.configuration")).toBeInTheDocument();
    expect(screen.getByText("errors.invalidConfiguration")).toBeInTheDocument();
  });

  it("shows the empty-state when there are no rows", () => {
    const viz = buildViz();
    render(<LollipopRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("renders the chart frame with rows + both axes configured", () => {
    const viz = buildViz();
    const rows = [
      { variety: "Tomato", yield: 12 },
      { variety: "Cucumber", yield: 8 },
    ];
    const { container } = render(
      <LollipopRenderer visualization={viz} experimentId="exp-1" data={rows} />,
    );
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
    expect(container.querySelector(".flex.h-full.w-full.flex-col")).toBeInTheDocument();
  });

  it("falls back to the empty-state when X is not configured", () => {
    // Lollipop is single-series and has no row-index fallback for X; without
    // a category column there's nothing to anchor stems to. The frame stays
    // mounted but renders the no-data placeholder.
    const viz = buildViz({
      dataConfig: {
        tableName: "harvest",
        dataSources: [
          { tableName: "harvest", columnName: "", role: "x" },
          { tableName: "harvest", columnName: "yield", role: "y" },
        ],
      },
    });
    const rows = [{ yield: 12 }, { yield: 8 }];
    render(<LollipopRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("falls back to the empty-state when Y is not configured", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "harvest",
        dataSources: [
          { tableName: "harvest", columnName: "variety", role: "x" },
          { tableName: "harvest", columnName: "", role: "y" },
        ],
      },
    });
    render(<LollipopRenderer visualization={viz} experimentId="exp-1" data={[{ variety: "T" }]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("falls back to the empty-state when the Y data source is missing entirely", () => {
    // Reading `[0].source.columnName` would have crashed the public page
    // renderer; the empty-state is the right user-visible behavior.
    const viz = buildViz({
      dataConfig: {
        tableName: "harvest",
        dataSources: [{ tableName: "harvest", columnName: "variety", role: "x" }],
      },
    });
    render(<LollipopRenderer visualization={viz} experimentId="exp-1" data={[{ variety: "T" }]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("computes per-row error magnitudes when the Y source declares an errorColumn", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "harvest",
        dataSources: [
          { tableName: "harvest", columnName: "variety", role: "x" },
          { tableName: "harvest", columnName: "yield", role: "y", errorColumn: "yield_err" },
        ],
      },
    });
    const rows = [
      { variety: "Tomato", yield: 12, yield_err: 0.5 },
      { variety: "Cucumber", yield: 8, yield_err: "0.4" },
      { variety: "Pepper", yield: 6, yield_err: "nan" },
    ];
    render(<LollipopRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("renders in horizontal orientation without throwing", () => {
    const viz = buildViz({
      config: { ...lollipopDefaultConfig(), orientation: "h" },
    });
    const rows = [
      { variety: "Tomato", yield: 12 },
      { variety: "Cucumber", yield: 8 },
    ];
    render(<LollipopRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });
});
