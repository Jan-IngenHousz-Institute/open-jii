import { createExperimentDataTable, createVisualization } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import { beforeEach, describe, it, expect } from "vitest";

import { contract } from "@repo/api/contract";

import ExperimentVisualizationRenderer from "./experiment-visualization-renderer";

vi.mock("./charts/line/renderer", () => ({
  LineRenderer: ({ visualization }: { visualization: { name: string } }) => (
    <div data-testid="line-chart-renderer">Line Chart: {visualization.name}</div>
  ),
}));

vi.mock("./charts/scatter/renderer", () => ({
  ScatterRenderer: ({ visualization }: { visualization: { name: string } }) => (
    <div data-testid="scatter-chart-renderer">Scatter Chart: {visualization.name}</div>
  ),
}));

vi.mock("./charts/bar/renderer", () => ({
  BarRenderer: ({ visualization }: { visualization: { name: string } }) => (
    <div data-testid="bar-chart-renderer">Bar Chart: {visualization.name}</div>
  ),
}));

describe("ExperimentVisualizationRenderer", () => {
  const experimentId = "exp-123";

  it("dispatches to LineRenderer for chartType=line", () => {
    const visualization = createVisualization({ chartType: "line", name: "My Line" });
    render(
      <ExperimentVisualizationRenderer visualization={visualization} experimentId={experimentId} />,
    );
    expect(screen.getByTestId("line-chart-renderer")).toHaveTextContent("Line Chart: My Line");
  });

  it("dispatches to ScatterRenderer for chartType=scatter", () => {
    const visualization = createVisualization({ chartType: "scatter", name: "My Scatter" });
    render(
      <ExperimentVisualizationRenderer visualization={visualization} experimentId={experimentId} />,
    );
    expect(screen.getByTestId("scatter-chart-renderer")).toHaveTextContent(
      "Scatter Chart: My Scatter",
    );
  });

  it("dispatches to BarRenderer for chartType=bar", () => {
    const visualization = createVisualization({ chartType: "bar", name: "My Bar" });
    render(
      <ExperimentVisualizationRenderer visualization={visualization} experimentId={experimentId} />,
    );
    expect(screen.getByTestId("bar-chart-renderer")).toHaveTextContent("Bar Chart: My Bar");
  });

  it("renders the unsupported placeholder for an unregistered chart type", () => {
    const visualization = createVisualization({ chartType: "alluvial" });
    render(
      <ExperimentVisualizationRenderer visualization={visualization} experimentId={experimentId} />,
    );
    expect(screen.getByText("errors.unsupportedChartType")).toBeInTheDocument();
  });

  it("renders title and description by default", () => {
    const visualization = createVisualization({ name: "Title", description: "Subtitle" });
    render(
      <ExperimentVisualizationRenderer visualization={visualization} experimentId={experimentId} />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Title" })).toBeInTheDocument();
    expect(screen.getByText("Subtitle")).toBeInTheDocument();
  });

  it("hides title and description when showTitle/showDescription are false", () => {
    const visualization = createVisualization({ name: "Hidden", description: "Hidden desc" });
    render(
      <ExperimentVisualizationRenderer
        visualization={visualization}
        experimentId={experimentId}
        showTitle={false}
        showDescription={false}
      />,
    );
    expect(screen.queryByRole("heading", { level: 2, name: "Hidden" })).not.toBeInTheDocument();
    expect(screen.queryByText("Hidden desc")).not.toBeInTheDocument();
  });
});
