import { createVisualization, createVisualizationWidget } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import VisualizationWidgetView from "./visualization-widget";

vi.mock("../../../experiment-visualizations/experiment-visualization-renderer", () => ({
  default: ({ visualization }: { visualization: { name: string } }) => (
    <div data-testid="viz-renderer">{visualization.name}</div>
  ),
}));

describe("VisualizationWidgetView", () => {
  it("shows the empty state when no visualization is linked", () => {
    const widget = createVisualizationWidget({
      config: { visualizationId: undefined, showTitle: true, showDescription: false },
    });
    render(<VisualizationWidgetView widget={widget} experimentId="exp-1" />);
    expect(screen.getByText("widget.emptyVisualization")).toBeInTheDocument();
    expect(screen.getByText("widget.emptyVisualizationDescription")).toBeInTheDocument();
  });

  it("renders the linked visualization once data has loaded", async () => {
    const viz = createVisualization({ name: "My Chart" });
    server.mount(contract.experiments.listExperimentVisualizations, { body: [] });
    server.mount(contract.experiments.getExperimentVisualization, { body: viz });
    const widget = createVisualizationWidget({
      config: { visualizationId: viz.id, showTitle: true, showDescription: false },
    });

    render(<VisualizationWidgetView widget={widget} experimentId="exp-1" />);
    await waitFor(() => expect(screen.getByTestId("viz-renderer")).toHaveTextContent("My Chart"));
  });

  it("reads the visualization from the experiment's list instead of its own request", async () => {
    const viz = createVisualization({ name: "Listed Chart" });
    server.mount(contract.experiments.listExperimentVisualizations, { body: [viz] });
    const single = server.mount(contract.experiments.getExperimentVisualization, { body: viz });
    const widget = createVisualizationWidget({
      config: { visualizationId: viz.id, showTitle: true, showDescription: false },
    });

    render(<VisualizationWidgetView widget={widget} experimentId="exp-1" />);
    await waitFor(() =>
      expect(screen.getByTestId("viz-renderer")).toHaveTextContent("Listed Chart"),
    );
    expect(single.called).toBe(false);
  });

  it("shows the missing-viz empty state when the fetch errors out", async () => {
    server.mount(contract.experiments.listExperimentVisualizations, { body: [] });
    server.mount(contract.experiments.getExperimentVisualization, { status: 404 });
    const widget = createVisualizationWidget({
      config: {
        visualizationId: "00000000-0000-0000-0000-000000000001",
        showTitle: true,
        showDescription: false,
      },
    });

    render(<VisualizationWidgetView widget={widget} experimentId="exp-1" />);
    await waitFor(() =>
      expect(screen.getByText("widget.missingVisualization")).toBeInTheDocument(),
    );
  });
});
