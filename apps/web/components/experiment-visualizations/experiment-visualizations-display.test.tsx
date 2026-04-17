import { createExperimentDataTable, createVisualization } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api";

import ExperimentVisualizationsDisplay from "./experiment-visualizations-display";

vi.mock("./experiment-visualization-renderer", () => ({
  default: ({ visualization }: { visualization: { name: string } }) => (
    <div role="img" aria-label={visualization.name} />
  ),
}));

function mountExperimentData(opts: { delay?: number } = {}) {
  return server.mount(contract.experiments.getExperimentData, {
    body: [createExperimentDataTable()],
    ...opts,
  });
}

describe("ExperimentVisualizationsDisplay", () => {
  it("shows loading skeleton when isLoading prop is true", () => {
    render(
      <ExperimentVisualizationsDisplay experimentId="exp-1" visualizations={[]} isLoading={true} />,
    );

    expect(screen.getByText("ui.title")).toBeInTheDocument();
    expect(screen.getByText("selector.noVisualizations")).toBeInTheDocument();
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows empty message when no visualizations exist", () => {
    render(
      <ExperimentVisualizationsDisplay
        experimentId="exp-1"
        visualizations={[]}
        isLoading={false}
      />,
    );

    expect(screen.getByText("selector.noVisualizations")).toBeInTheDocument();
  });

  it("auto-selects the first visualization and renders it", async () => {
    mountExperimentData();
    const viz1 = createVisualization({ name: "Line Chart" });
    const viz2 = createVisualization({ name: "Scatter Plot", chartType: "scatter" });

    render(
      <ExperimentVisualizationsDisplay
        experimentId="exp-1"
        visualizations={[viz1, viz2]}
        isLoading={false}
      />,
    );

    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(await screen.findByRole("img", { name: "Line Chart" })).toBeInTheDocument();
  });

  it("renders renderer once data arrives", async () => {
    mountExperimentData();
    const viz = createVisualization({ name: "Temperature Trend" });

    render(
      <ExperimentVisualizationsDisplay
        experimentId="exp-1"
        visualizations={[viz]}
        isLoading={false}
      />,
    );

    expect(await screen.findByRole("img", { name: "Temperature Trend" })).toBeInTheDocument();
  });
});
