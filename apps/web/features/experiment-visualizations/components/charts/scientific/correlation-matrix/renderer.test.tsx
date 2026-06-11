import { createVisualization } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { aliasForCorrelationPair } from "../../data/correlation-alias";
import { correlationMatrixDefaultConfig } from "./defaults";
import { CorrelationMatrixRenderer } from "./renderer";

function buildViz(overrides: Parameters<typeof createVisualization>[0] = {}) {
  return createVisualization({
    chartType: "correlation-matrix",
    chartFamily: "scientific",
    config: { ...correlationMatrixDefaultConfig() },
    dataConfig: {
      tableName: "device",
      dataSources: [
        { tableName: "device", columnName: "temperature", role: "y" },
        { tableName: "device", columnName: "humidity", role: "y" },
        { tableName: "device", columnName: "pressure", role: "y" },
      ],
    },
    ...overrides,
  });
}

describe("CorrelationMatrixRenderer", () => {
  it("shows a config error when the visualization isn't a correlation-matrix", () => {
    const viz = buildViz({ chartType: "heatmap" });
    render(<CorrelationMatrixRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.configuration")).toBeInTheDocument();
  });

  it("shows a chart-specific message when fewer than 2 columns are picked", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "device",
        dataSources: [{ tableName: "device", columnName: "temperature", role: "y" }],
      },
    });
    render(
      <CorrelationMatrixRenderer
        visualization={viz}
        experimentId="exp-1"
        data={[
          {
            /* no rows needed when fewer columns */
          },
        ]}
      />,
    );
    expect(screen.getByText("errors.correlationMatrixNeedsTwoColumns")).toBeInTheDocument();
  });

  it("shows the empty-state when no rows are returned", () => {
    const viz = buildViz();
    render(<CorrelationMatrixRenderer visualization={viz} experimentId="exp-1" data={[]} />);
    expect(screen.getByText("errors.noData")).toBeInTheDocument();
  });

  it("builds a symmetric matrix from the bivariate aggregate response row", () => {
    const viz = buildViz();
    // The data-panel materialises one `corr` aggregate per pair; the
    // backend projects each under the alias produced by
    // `aliasForCorrelationPair`. Diagonal is filled in by the renderer
    // as 1.0.
    const row: Record<string, unknown> = {
      [aliasForCorrelationPair("temperature", "humidity")]: 0.42,
      [aliasForCorrelationPair("temperature", "pressure")]: -0.3,
      [aliasForCorrelationPair("humidity", "pressure")]: 0.1,
    };
    render(<CorrelationMatrixRenderer visualization={viz} experimentId="exp-1" data={[row]} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });

  it("dedupes column picks so a duplicate Y row doesn't introduce a phantom pair", () => {
    const viz = buildViz({
      dataConfig: {
        tableName: "device",
        dataSources: [
          { tableName: "device", columnName: "temperature", role: "y" },
          { tableName: "device", columnName: "humidity", role: "y" },
          { tableName: "device", columnName: "humidity", role: "y" },
        ],
      },
    });
    const row = { [aliasForCorrelationPair("temperature", "humidity")]: 0.42 };
    render(<CorrelationMatrixRenderer visualization={viz} experimentId="exp-1" data={[row]} />);
    expect(screen.queryByText("errors.invalidConfiguration")).not.toBeInTheDocument();
    expect(screen.queryByText("errors.noData")).not.toBeInTheDocument();
  });
});

describe("aliasForCorrelationPair", () => {
  it("is order-independent", () => {
    expect(aliasForCorrelationPair("a", "b")).toBe(aliasForCorrelationPair("b", "a"));
  });

  it("replaces whitespace in column names", () => {
    expect(aliasForCorrelationPair("Ambient Pressure", "Leaf Temperature")).toBe(
      "corr__Ambient_Pressure__Leaf_Temperature",
    );
  });
});
