import { createVisualization } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { pieDefaultConfig } from "./defaults";
import { PieRenderer } from "./renderer";

function buildViz(overrides: Parameters<typeof createVisualization>[0] = {}) {
  return createVisualization({
    chartType: "pie",
    chartFamily: "basic",
    config: { ...pieDefaultConfig() },
    dataConfig: {
      tableName: "harvest",
      dataSources: [
        { tableName: "harvest", columnName: "variety", role: "labels" },
        { tableName: "harvest", columnName: "yield", role: "values" },
      ],
    },
    ...overrides,
  });
}

describe("PieRenderer", () => {
  it("shows a config error when the visualization isn't a pie chart", () => {
    const viz = buildViz({ chartType: "line" });
    render(<PieRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.configuration")).toBeInTheDocument();
    expect(screen.getByText("errors.invalidConfiguration")).toBeInTheDocument();
  });

  it("shows the empty-state when there are no rows", () => {
    const viz = buildViz();
    render(<PieRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("renders the chart frame with rows + labels/values configured", () => {
    const viz = buildViz();
    const rows = [
      { variety: "Tomato", yield: 12 },
      { variety: "Cucumber", yield: 8 },
      { variety: "Pepper", yield: 5 },
    ];
    const { container } = render(
      <PieRenderer visualization={viz} experimentId="exp-1" data={rows} />,
    );
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
    expect(container.querySelector(".flex.h-full.w-full.flex-col")).toBeInTheDocument();
  });

  it("falls back to the empty-state when labels column is unset", () => {
    // Pie has no axis fallback the way line/scatter synthesise an X index;
    // without a labels column the slices aren't meaningful, so the frame
    // mounts but renders the no-data placeholder.
    const viz = buildViz({
      dataConfig: {
        tableName: "harvest",
        dataSources: [
          { tableName: "harvest", columnName: "", role: "labels" },
          { tableName: "harvest", columnName: "yield", role: "values" },
        ],
      },
    });
    render(<PieRenderer visualization={viz} experimentId="exp-1" data={[{ yield: 12 }]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("falls back to the empty-state when values column is unset", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "harvest",
        dataSources: [
          { tableName: "harvest", columnName: "variety", role: "labels" },
          { tableName: "harvest", columnName: "", role: "values" },
        ],
      },
    });
    render(<PieRenderer visualization={viz} experimentId="exp-1" data={[{ variety: "A" }]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("renders pre-aggregated rows directly (one row per slice)", () => {
    // Pie expects server-side aggregation: `PieValuesShelf` writes the
    // aggregation entry on every column pick, so production rows always
    // arrive pre-aggregated (one row per category). The renderer no
    // longer collapses duplicates client-side; that responsibility is
    // upstream. Contract here is just "doesn't crash on the happy path".
    const viz = buildViz();
    const rows = [
      { variety: "Tomato", yield: 17 },
      { variety: "Cucumber", yield: 8 },
    ];
    render(<PieRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("renders in donut mode (hole > 0)", () => {
    const viz = buildViz({ config: { ...pieDefaultConfig(), hole: 0.4 } });
    const rows = [
      { variety: "A", yield: 10 },
      { variety: "B", yield: 20 },
    ];
    render(<PieRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });
});
