import { createVisualization } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { lineDefaultConfig } from "../basic/line/defaults";
import { CartesianRenderer } from "./cartesian-renderer";

function buildViz(overrides: Parameters<typeof createVisualization>[0] = {}) {
  return createVisualization({
    chartType: "line",
    chartFamily: "basic",
    config: lineDefaultConfig(),
    dataConfig: {
      tableName: "readings",
      dataSources: [
        { tableName: "readings", columnName: "time", role: "x" },
        { tableName: "readings", columnName: "load", role: "y" },
      ],
    },
    ...overrides,
  });
}

describe("CartesianRenderer", () => {
  it("shows the empty-state when there are no rows", () => {
    render(
      <CartesianRenderer
        visualization={buildViz()}
        experimentId="exp-1"
        data={[]}
        defaultTraceType="line"
      />,
    );
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("renders the chart frame with rows + both axes configured", () => {
    const rows = [
      { time: 1, load: 10 },
      { time: 2, load: 20 },
    ];
    const { container } = render(
      <CartesianRenderer
        visualization={buildViz()}
        experimentId="exp-1"
        data={rows}
        defaultTraceType="line"
      />,
    );
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
    expect(container.querySelector(".flex.h-full.w-full.flex-col")).toBeInTheDocument();
  });

  it("renders when only Y is configured (X synthesised from row indices)", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "readings",
        dataSources: [
          { tableName: "readings", columnName: "", role: "x" },
          { tableName: "readings", columnName: "load", role: "y" },
        ],
      },
    });
    const rows = [{ load: 10 }, { load: 20 }];
    render(
      <CartesianRenderer
        visualization={viz}
        experimentId="exp-1"
        data={rows}
        defaultTraceType="line"
      />,
    );
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("renders multiple Y series without throwing", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "readings",
        dataSources: [
          { tableName: "readings", columnName: "time", role: "x" },
          { tableName: "readings", columnName: "load", role: "y" },
          { tableName: "readings", columnName: "saturation", role: "y" },
        ],
      },
    });
    const rows = [
      { time: 1, load: 10, saturation: 30 },
      { time: 2, load: 20, saturation: 40 },
    ];
    render(
      <CartesianRenderer
        visualization={viz}
        experimentId="exp-1"
        data={rows}
        defaultTraceType="line"
      />,
    );
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("renders with a categorical color mapping", () => {
    const viz = buildViz({
      config: { ...lineDefaultConfig(), colorMode: "categorical" },
      dataConfig: {
        tableName: "readings",
        dataSources: [
          { tableName: "readings", columnName: "time", role: "x" },
          { tableName: "readings", columnName: "load", role: "y" },
          { tableName: "readings", columnName: "lab", role: "color" },
        ],
      },
    });
    const rows = [
      { time: 1, load: 10, lab: "A" },
      { time: 2, load: 20, lab: "B" },
    ];
    render(
      <CartesianRenderer
        visualization={viz}
        experimentId="exp-1"
        data={rows}
        defaultTraceType="line"
      />,
    );
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("forwards the supportsContinuousColor flag without throwing", () => {
    const rows = [
      { time: 1, load: 10 },
      { time: 2, load: 20 },
    ];
    render(
      <CartesianRenderer
        visualization={buildViz()}
        experimentId="exp-1"
        data={rows}
        defaultTraceType="scatter"
        supportsContinuousColor
        supportsSize
      />,
    );
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });
});
