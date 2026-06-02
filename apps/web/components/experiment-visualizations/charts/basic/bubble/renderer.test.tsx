import { createVisualization } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { bubbleDefaultConfig } from "./defaults";
import { BubbleRenderer } from "./renderer";

function buildViz(overrides: Parameters<typeof createVisualization>[0] = {}) {
  return createVisualization({
    chartType: "bubble",
    chartFamily: "basic",
    config: { ...bubbleDefaultConfig() },
    dataConfig: {
      tableName: "metrics",
      dataSources: [
        { tableName: "metrics", columnName: "x", role: "x" },
        { tableName: "metrics", columnName: "y", role: "y" },
        { tableName: "metrics", columnName: "weight", role: "size" },
      ],
    },
    ...overrides,
  });
}

describe("BubbleRenderer", () => {
  it("shows a config error when the visualization isn't a bubble chart", () => {
    const viz = buildViz({ chartType: "scatter" });
    render(<BubbleRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.configuration")).toBeInTheDocument();
    expect(screen.getByText("errors.invalidConfiguration")).toBeInTheDocument();
  });

  it("shows the empty-state when there are no rows", () => {
    const viz = buildViz();
    render(<BubbleRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("renders the chart frame with rows + x/y/size configured", () => {
    const viz = buildViz();
    const rows = [
      { x: 1, y: 21, weight: 5 },
      { x: 2, y: 22, weight: 12 },
      { x: 3, y: 23, weight: 7 },
    ];
    const { container } = render(
      <BubbleRenderer visualization={viz} experimentId="exp-1" data={rows} />,
    );
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
    expect(container.querySelector(".flex.h-full.w-full.flex-col")).toBeInTheDocument();
  });

  it("renders without a size column (draft state, falls back to scalar size)", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "metrics",
        dataSources: [
          { tableName: "metrics", columnName: "x", role: "x" },
          { tableName: "metrics", columnName: "y", role: "y" },
          { tableName: "metrics", columnName: "", role: "size" },
        ],
      },
    });
    const rows = [
      { x: 1, y: 21 },
      { x: 2, y: 22 },
    ];
    render(<BubbleRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });

  it("renders multiple Y series each carrying the same size encoding", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "metrics",
        dataSources: [
          { tableName: "metrics", columnName: "x", role: "x" },
          { tableName: "metrics", columnName: "y1", role: "y" },
          { tableName: "metrics", columnName: "y2", role: "y" },
          { tableName: "metrics", columnName: "weight", role: "size" },
        ],
      },
    });
    const rows = [
      { x: 1, y1: 10, y2: 5, weight: 8 },
      { x: 2, y1: 12, y2: 6, weight: 14 },
    ];
    render(<BubbleRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });

  it("renders with a continuous color column", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "metrics",
        dataSources: [
          { tableName: "metrics", columnName: "x", role: "x" },
          { tableName: "metrics", columnName: "y", role: "y" },
          { tableName: "metrics", columnName: "weight", role: "size" },
          { tableName: "metrics", columnName: "score", role: "color" },
        ],
      },
    });
    const rows = [
      { x: 1, y: 10, weight: 8, score: 0.3 },
      { x: 2, y: 12, weight: 14, score: 0.7 },
    ];
    render(<BubbleRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });

  it("renders with a categorical color column (multi-trace)", () => {
    const viz = buildViz({
      config: { ...bubbleDefaultConfig(), colorMode: "categorical" },
      dataConfig: {
        tableName: "metrics",
        dataSources: [
          { tableName: "metrics", columnName: "x", role: "x" },
          { tableName: "metrics", columnName: "y", role: "y" },
          { tableName: "metrics", columnName: "weight", role: "size" },
          { tableName: "metrics", columnName: "group", role: "color" },
        ],
      },
    });
    const rows = [
      { x: 1, y: 10, weight: 8, group: "A" },
      { x: 2, y: 12, weight: 14, group: "B" },
      { x: 3, y: 11, weight: 9, group: "A" },
    ];
    render(<BubbleRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });

  it("renders in diameter sizemode without throwing", () => {
    const viz = buildViz({ config: { ...bubbleDefaultConfig(), sizemode: "diameter" } });
    const rows = [
      { x: 1, y: 10, weight: 5 },
      { x: 2, y: 12, weight: 15 },
    ];
    render(<BubbleRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });
});
