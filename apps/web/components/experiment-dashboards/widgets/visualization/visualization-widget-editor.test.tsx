import { createVisualization, createVisualizationWidget } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

import VisualizationWidgetEditor from "./visualization-widget-editor";

vi.mock("../../../experiment-visualizations/experiment-visualization-renderer", () => ({
  default: ({ visualization }: { visualization: { name: string } }) => (
    <div data-testid="viz-renderer">{visualization.name}</div>
  ),
}));

describe("VisualizationWidgetEditor", () => {
  it("shows the editor-specific empty hint when no visualization is picked", () => {
    const widget = createVisualizationWidget({
      config: { visualizationId: undefined, showTitle: true, showDescription: false },
    });
    render(<VisualizationWidgetEditor widget={widget} experimentId="exp-1" />);
    expect(screen.getByText("editor.visualizationConfig.pickVisualization")).toBeInTheDocument();
    expect(screen.getByText("editor.visualizationConfig.pickHint")).toBeInTheDocument();
  });

  it("delegates to the view component once a visualization is picked", async () => {
    const viz = createVisualization({ name: "Picked" });
    server.mount(orpcContract.experiments.getExperimentVisualization, { body: viz });
    const widget = createVisualizationWidget({
      config: { visualizationId: viz.id, showTitle: true, showDescription: false },
    });

    render(<VisualizationWidgetEditor widget={widget} experimentId="exp-1" />);
    await waitFor(() => expect(screen.getByTestId("viz-renderer")).toHaveTextContent("Picked"));
  });
});
