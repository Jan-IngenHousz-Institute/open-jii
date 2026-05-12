import { createExperimentDataTable, createVisualization } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import ExperimentVisualizationReadOnly from "./experiment-visualization-read-only";

// Convenience: data response that backs the renderer's data fetch with
// just enough rows to keep the chart from rendering its empty-state.
function dataTable() {
  return createExperimentDataTable({
    data: {
      columns: [
        { name: "time", type_name: "DOUBLE", type_text: "DOUBLE" },
        { name: "value", type_name: "DOUBLE", type_text: "DOUBLE" },
      ],
      rows: [
        { time: 1, value: 10 },
        { time: 2, value: 20 },
      ],
      totalRows: 2,
      truncated: false,
    },
  });
}

describe("ExperimentVisualizationReadOnly", () => {
  it("shows the loading message while the visualization request is in flight", () => {
    server.mount(contract.experiments.getExperimentVisualization, {
      body: createVisualization({ id: "viz-1" }),
      delay: 100,
    });

    render(<ExperimentVisualizationReadOnly experimentId="exp-1" visualizationId="viz-1" />);

    expect(screen.getByText("ui.messages.loading")).toBeInTheDocument();
  });

  it("shows the failure card with a back button when the request errors", async () => {
    server.mount(contract.experiments.getExperimentVisualization, { status: 500 });

    render(<ExperimentVisualizationReadOnly experimentId="exp-1" visualizationId="viz-1" />);

    await waitFor(() => {
      expect(screen.getByText("ui.messages.failedToLoad")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /ui\.actions\.back/ })).toBeInTheDocument();
  });

  it("renders the visualization name once data arrives", async () => {
    server.mount(contract.experiments.getExperimentVisualization, {
      body: createVisualization({ id: "viz-42", name: "My Chart" }),
    });
    server.mount(contract.experiments.getExperimentData, { body: [dataTable()] });

    render(<ExperimentVisualizationReadOnly experimentId="exp-1" visualizationId="viz-42" />);

    await waitFor(() => {
      expect(screen.getByText("My Chart")).toBeInTheDocument();
    });
  });

  it("renders the description when present on the visualization", async () => {
    server.mount(contract.experiments.getExperimentVisualization, {
      body: createVisualization({ id: "viz-1", description: "Some description" }),
    });
    server.mount(contract.experiments.getExperimentData, { body: [dataTable()] });

    render(<ExperimentVisualizationReadOnly experimentId="exp-1" visualizationId="viz-1" />);

    await waitFor(() => {
      expect(screen.getByText("Some description")).toBeInTheDocument();
    });
  });

  it("navigates back to the experiments-archive overview when the back button is clicked", async () => {
    server.mount(contract.experiments.getExperimentVisualization, { status: 500 });

    const { router } = render(
      <ExperimentVisualizationReadOnly experimentId="exp-99" visualizationId="viz-1" />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /ui\.actions\.back/ })).toBeInTheDocument();
    });

    screen.getByRole("button", { name: /ui\.actions\.back/ }).click();
    expect(router.push).toHaveBeenCalledWith("/en-US/platform/experiments-archive/exp-99");
  });
});
