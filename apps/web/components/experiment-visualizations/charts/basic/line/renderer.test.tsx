import { createVisualization } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { lineDefaultConfig } from "./defaults";
import { LineRenderer } from "./renderer";

function buildViz(overrides: Parameters<typeof createVisualization>[0] = {}) {
  return createVisualization({
    chartType: "line",
    chartFamily: "basic",
    config: lineDefaultConfig() as unknown as Record<string, unknown>,
    dataConfig: {
      tableName: "readings",
      dataSources: [
        { tableName: "readings", columnName: "time", role: "x" },
        { tableName: "readings", columnName: "temp", role: "y" },
      ],
    },
    ...overrides,
  });
}

describe("LineRenderer", () => {
  it("shows a config error when the visualization isn't a line chart", () => {
    const viz = buildViz({ chartType: "scatter" });
    render(<LineRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.configuration")).toBeInTheDocument();
    expect(screen.getByText("errors.invalidConfiguration")).toBeInTheDocument();
  });

  it("shows the empty-state when there are no rows", () => {
    const viz = buildViz();
    render(<LineRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("renders the chart frame with rows + both axes configured", () => {
    const viz = buildViz();
    const rows = [
      { time: 1, temp: 21 },
      { time: 2, temp: 22 },
    ];
    const { container } = render(
      <LineRenderer visualization={viz} experimentId="exp-1" data={rows} />,
    );
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
    expect(container.querySelector(".flex.h-full.w-full.flex-col")).toBeInTheDocument();
  });

  it("renders multiple Y series (one trace per series)", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "readings",
        dataSources: [
          { tableName: "readings", columnName: "time", role: "x" },
          { tableName: "readings", columnName: "temp", role: "y" },
          { tableName: "readings", columnName: "humidity", role: "y" },
        ],
      },
    });
    const rows = [
      { time: 1, temp: 21, humidity: 40 },
      { time: 2, temp: 22, humidity: 41 },
    ];
    render(<LineRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
  });

  it("renders when only Y is configured (X synthesised from row indices)", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "readings",
        dataSources: [
          { tableName: "readings", columnName: "", role: "x" },
          { tableName: "readings", columnName: "temp", role: "y" },
        ],
      },
    });
    const rows = [{ temp: 21 }, { temp: 22 }];
    render(<LineRenderer visualization={viz} experimentId="exp-1" data={rows} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });
});
