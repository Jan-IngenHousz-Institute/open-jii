import { createVisualization, createVisualizationWidget } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

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
    server.mount(orpcContract.experiments.getExperimentVisualization, { body: viz });
    const widget = createVisualizationWidget({
      config: { visualizationId: viz.id, showTitle: true, showDescription: false },
    });

    render(<VisualizationWidgetView widget={widget} experimentId="exp-1" />);
    await waitFor(() => expect(screen.getByTestId("viz-renderer")).toHaveTextContent("My Chart"));
  });

  it("shows the missing-viz empty state when the fetch errors out", async () => {
    server.mount(orpcContract.experiments.getExperimentVisualization, { status: 404 });
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
