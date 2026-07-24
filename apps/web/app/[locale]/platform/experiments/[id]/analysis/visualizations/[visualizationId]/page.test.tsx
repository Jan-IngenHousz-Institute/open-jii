import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import VisualizationEditorPage from "./page";

vi.mock("@/components/experiment-visualizations/workspace/visualization-workspace", () => ({
  VisualizationWorkspace: ({
    experimentId,
    visualizationId,
  }: {
    experimentId: string;
    visualizationId: string;
  }) => (
    <div data-testid="workspace">
      workspace:{experimentId}:{visualizationId}
    </div>
  ),
}));

describe("VisualizationEditorPage", () => {
  it("renders the workspace with the awaited route params", async () => {
    render(
      await VisualizationEditorPage({
        params: Promise.resolve({ locale: "en-US", id: "exp-1", visualizationId: "viz-1" }),
      }),
    );
    expect(screen.getByTestId("workspace")).toHaveTextContent("workspace:exp-1:viz-1");
  });
});
