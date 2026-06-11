import { render, screen } from "@/test/test-utils";
import { useParams } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import VisualizationEditorPage from "./page";

vi.mock(
  "@/features/experiment-visualizations/components/workspace/visualization-workspace",
  () => ({
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
  }),
);

describe("VisualizationEditorPage", () => {
  it("renders the workspace with the route params", () => {
    vi.mocked(useParams).mockReturnValue({ id: "exp-1", visualizationId: "viz-1" });
    render(<VisualizationEditorPage />);
    expect(screen.getByTestId("workspace")).toHaveTextContent("workspace:exp-1:viz-1");
  });
});
