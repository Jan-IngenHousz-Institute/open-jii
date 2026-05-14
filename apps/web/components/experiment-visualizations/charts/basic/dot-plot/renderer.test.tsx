import { createVisualization } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { dotPlotDefaultConfig } from "./defaults";
import { DotPlotRenderer } from "./renderer";

function buildViz(overrides: Parameters<typeof createVisualization>[0] = {}) {
  return createVisualization({
    chartType: "dot-plot",
    chartFamily: "basic",
    config: { ...dotPlotDefaultConfig() },
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

describe("DotPlotRenderer", () => {
  it("shows a config error when the visualization isn't a dot-plot", () => {
    const viz = buildViz({ chartType: "line" });
    render(<DotPlotRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.configuration")).toBeInTheDocument();
    expect(screen.getByText("errors.invalidConfiguration")).toBeInTheDocument();
  });

  it("shows the empty-state when there are no rows", () => {
    const viz = buildViz();
    render(<DotPlotRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("renders the chart frame with rows + both axes configured", () => {
    const viz = buildViz();
    const rows = [
      { variety: "Tomato", yield: 12 },
      { variety: "Cucumber", yield: 8 },
    ];
    const { container } = render(
      <DotPlotRenderer visualization={viz} experimentId="exp-1" data={rows} />,
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
    render(<DotPlotRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });

  it("renders nothing-but-frame when X is not configured", () => {
    // Dot plots don't synthesize X from row indices; there's no meaningful
    // category fallback. The renderer should still mount without erroring.
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
    render(<DotPlotRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });

  it("renders in horizontal orientation without throwing", () => {
    const viz = buildViz({
      config: { ...dotPlotDefaultConfig(), orientation: "h" },
    });
    const rows = [
      { variety: "Tomato", yield: 12 },
      { variety: "Cucumber", yield: 8 },
    ];
    render(<DotPlotRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });

  it("emits one trace per (Y x color category) when a color column is set", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "harvest",
        dataSources: [
          { tableName: "harvest", columnName: "variety", role: "x" },
          { tableName: "harvest", columnName: "yield", role: "y" },
          { tableName: "harvest", columnName: "region", role: "color" },
        ],
      },
    });
    const rows = [
      { variety: "Tomato", yield: 12, region: "north" },
      { variety: "Cucumber", yield: 8, region: "north" },
      { variety: "Tomato", yield: 15, region: "south" },
      { variety: "Cucumber", yield: 9, region: "south" },
      // Row with a null category exercises the labelValue = null branch.
      { variety: "Pepper", yield: 6, region: null },
    ];
    render(<DotPlotRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    // The chart mounts (no config error); the group-by codepath was the bug here.
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("falls through the non-scalar color value branch (toBucketKey-derived label)", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "harvest",
        dataSources: [
          { tableName: "harvest", columnName: "variety", role: "x" },
          { tableName: "harvest", columnName: "yield", role: "y" },
          { tableName: "harvest", columnName: "tags", role: "color" },
        ],
      },
    });
    const rows = [
      // Object-valued color cell hits the else branch where labelValue = key.
      { variety: "Tomato", yield: 12, tags: { ripe: true } },
      { variety: "Cucumber", yield: 8, tags: { ripe: false } },
    ];
    render(<DotPlotRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });

  it("attaches error bars when a Y source has an errorColumn (vertical orientation -> error_y)", () => {
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
      { variety: "Cucumber", yield: 8, yield_err: "0.4" }, // string coerces via Number(v)
      { variety: "Pepper", yield: 6, yield_err: "nan" }, // non-finite falls through to 0
    ];
    render(<DotPlotRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("attaches error bars on the X axis in horizontal orientation (error_x)", () => {
    const viz = buildViz({
      config: { ...dotPlotDefaultConfig(), orientation: "h" },
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
      { variety: "Cucumber", yield: 8, yield_err: 0.4 },
    ];
    render(<DotPlotRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });
});
