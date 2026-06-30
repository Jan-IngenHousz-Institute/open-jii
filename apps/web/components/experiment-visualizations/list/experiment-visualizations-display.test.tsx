import { createExperimentDataTable, createVisualization } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent } from "@/test/test-utils";
import { beforeEach, describe, it, expect } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

import ExperimentVisualizationsDisplay from "./experiment-visualizations-display";

describe("ExperimentVisualizationsDisplay", () => {
  beforeEach(() => {
    // The auto-selected viz mounts the real chart renderer, which fetches
    // via useChartData; provide an empty default so MSW stops warning.
    server.mount(orpcContract.experiments.getExperimentData, {
      body: [createExperimentDataTable()],
    });
  });

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

  it("auto-selects the first visualization so its name appears in the selector trigger", () => {
    const viz1 = createVisualization({ name: "Line Chart" });
    const viz2 = createVisualization({ name: "Scatter Plot", chartType: "scatter" });

    render(
      <ExperimentVisualizationsDisplay
        experimentId="exp-1"
        visualizations={[viz1, viz2]}
        isLoading={false}
      />,
    );

    expect(screen.getByRole("combobox")).toHaveTextContent("Line Chart");
  });

  it("swaps the selected visualization when the user picks a different option", async () => {
    const user = userEvent.setup();
    const viz1 = createVisualization({ name: "Line Chart" });
    const viz2 = createVisualization({ name: "Scatter Plot", chartType: "scatter" });

    render(
      <ExperimentVisualizationsDisplay
        experimentId="exp-1"
        visualizations={[viz1, viz2]}
        isLoading={false}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: /Scatter Plot/ }));

    expect(screen.getByRole("combobox")).toHaveTextContent("Scatter Plot");
  });
});
