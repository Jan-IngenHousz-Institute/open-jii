import { render, screen } from "@/test/test-utils";
import { notFound } from "next/navigation";
import { vi, describe, it, expect } from "vitest";

import ArchivedVisualizationDetailPage from "./page";

vi.mock(
  "@/features/experiment-visualizations/components/experiment-visualization-read-only",
  () => ({
    default: ({
      experimentId,
      visualizationId,
    }: {
      experimentId: string;
      visualizationId: string;
    }) => (
      <div data-testid="visualization-readonly">
        <div data-testid="experiment-id">{experimentId}</div>
        <div data-testid="visualization-id">{visualizationId}</div>
      </div>
    ),
  }),
);

describe("ArchivedVisualizationDetailPage", () => {
  it("renders the read-only viz with correct ids", async () => {
    const params = Promise.resolve({
      locale: "en-US",
      id: "exp-1",
      visualizationId: "viz-1",
    });
    const result = await ArchivedVisualizationDetailPage({ params });
    render(result);
    expect(screen.getByTestId("experiment-id")).toHaveTextContent("exp-1");
    expect(screen.getByTestId("visualization-id")).toHaveTextContent("viz-1");
  });

  it("calls notFound when ids are missing", async () => {
    await ArchivedVisualizationDetailPage({
      params: Promise.resolve({ locale: "en-US", id: "", visualizationId: "" }),
    });
    expect(vi.mocked(notFound)).toHaveBeenCalled();
  });
});
