import { createVisualization, createVisualizationWidget } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

import { LoadedVisualizationView } from "./loaded-visualization-view";

vi.mock("../../../experiment-visualizations/experiment-visualization-renderer", () => ({
  default: ({ visualization }: { visualization: { name: string } }) => (
    <div data-testid="viz-renderer">{visualization.name}</div>
  ),
}));

describe("LoadedVisualizationView", () => {
  it("renders the loading state while the fetch is in flight", () => {
    server.mount(orpcContract.experiments.getExperimentVisualization, {
      body: createVisualization(),
      delay: "infinite",
    });
    const widget = createVisualizationWidget({
      config: { visualizationId: "viz-1", showTitle: true, showDescription: false },
    });

    render(
      <LoadedVisualizationView widget={widget} visualizationId="viz-1" experimentId="exp-1" />,
    );
    expect(screen.getByText("ui.messages.loading")).toBeInTheDocument();
  });

  it("falls back to the visualization's name when no title override is set", async () => {
    const viz = createVisualization({ name: "Photosynthesis" });
    server.mount(orpcContract.experiments.getExperimentVisualization, { body: viz });
    const widget = createVisualizationWidget({
      config: { visualizationId: viz.id, showTitle: true, showDescription: false },
    });

    render(
      <LoadedVisualizationView widget={widget} visualizationId={viz.id} experimentId="exp-1" />,
    );
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Photosynthesis" })).toBeInTheDocument(),
    );
  });

  it("prefers the widget's title override over the visualization's name", async () => {
    const viz = createVisualization({ name: "Photosynthesis" });
    server.mount(orpcContract.experiments.getExperimentVisualization, { body: viz });
    const widget = createVisualizationWidget({
      config: {
        visualizationId: viz.id,
        showTitle: true,
        showDescription: false,
        title: "Custom Title",
      },
    });

    render(
      <LoadedVisualizationView widget={widget} visualizationId={viz.id} experimentId="exp-1" />,
    );
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Custom Title" })).toBeInTheDocument(),
    );
  });

  it("hides the header entirely when both show flags are off", async () => {
    const viz = createVisualization({ name: "Photosynthesis", description: "Long" });
    server.mount(orpcContract.experiments.getExperimentVisualization, { body: viz });
    const widget = createVisualizationWidget({
      config: { visualizationId: viz.id, showTitle: false, showDescription: false },
    });

    render(
      <LoadedVisualizationView widget={widget} visualizationId={viz.id} experimentId="exp-1" />,
    );
    await waitFor(() => expect(screen.getByTestId("viz-renderer")).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "Photosynthesis" })).not.toBeInTheDocument();
  });

  it("shows the missing-viz empty state when the fetch fails", async () => {
    server.mount(orpcContract.experiments.getExperimentVisualization, { status: 404 });
    const widget = createVisualizationWidget({
      config: { visualizationId: "viz-1", showTitle: true, showDescription: false },
    });

    render(
      <LoadedVisualizationView widget={widget} visualizationId="viz-1" experimentId="exp-1" />,
    );
    await waitFor(() =>
      expect(screen.getByText("widget.missingVisualization")).toBeInTheDocument(),
    );
  });
});
