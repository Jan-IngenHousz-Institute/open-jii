import { createVisualization } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { barDefaultConfig } from "./defaults";
import { BarRenderer } from "./renderer";

function buildViz(overrides: Parameters<typeof createVisualization>[0] = {}) {
  return createVisualization({
    chartType: "bar",
    chartFamily: "basic",
    config: { ...barDefaultConfig() },
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

describe("BarRenderer", () => {
  it("shows a config error when the visualization isn't a bar chart", () => {
    const viz = buildViz({ chartType: "line" });
    render(<BarRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.configuration")).toBeInTheDocument();
    expect(screen.getByText("errors.invalidConfiguration")).toBeInTheDocument();
  });

  it("shows the empty-state when there are no rows", () => {
    const viz = buildViz();
    render(<BarRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("renders the chart frame with rows + both axes configured", () => {
    const viz = buildViz();
    const rows = [
      { variety: "Tomato", yield: 12 },
      { variety: "Cucumber", yield: 8 },
    ];
    const { container } = render(
      <BarRenderer visualization={viz} experimentId="exp-1" data={rows} />,
    );
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
    expect(container.querySelector(".flex.h-full.w-full.flex-col")).toBeInTheDocument();
  });

  it("renders multiple Y series (one trace per series)", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "harvest",
        dataSources: [
          { tableName: "harvest", columnName: "variety", role: "x" },
          { tableName: "harvest", columnName: "yield", role: "y" },
          { tableName: "harvest", columnName: "weight", role: "y" },
        ],
      },
    });
    const rows = [
      { variety: "Tomato", yield: 12, weight: 4.2 },
      { variety: "Cucumber", yield: 8, weight: 3.0 },
    ];
    render(<BarRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });

  it("renders the empty axes (no traces) when X is not configured", () => {
    // Bar charts can't synthesize X from row indices the way line/scatter do;
    // numbered-bar fallbacks don't carry meaning. The renderer should still
    // mount the frame but emit zero traces; we assert the no-error path.
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
    render(<BarRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });

  it("renders in horizontal orientation without throwing", () => {
    const viz = buildViz({
      config: { ...barDefaultConfig(), orientation: "h" },
    });
    const rows = [
      { variety: "Tomato", yield: 12 },
      { variety: "Cucumber", yield: 8 },
    ];
    render(<BarRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });
});
