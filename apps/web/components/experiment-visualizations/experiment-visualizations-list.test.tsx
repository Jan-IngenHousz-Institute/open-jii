import { createVisualization } from "@/test/factories";
import { render, screen } from "@/test/test-utils";
import { formatDate } from "@/util/date";
import { describe, it, expect } from "vitest";

import type { ExperimentVisualization } from "@repo/api";

import ExperimentVisualizationsList from "./experiment-visualizations-list";

const expId = "exp-123";

function viz(overrides: Partial<ExperimentVisualization> = {}): ExperimentVisualization {
  return createVisualization({
    id: "viz-1",
    experimentId: expId,
    name: "Test Visualization",
    description: "A test desc",
    createdBy: "user-123",
    createdByName: "Test User",
    createdAt: new Date("2024-01-01").toISOString(),
    updatedAt: new Date("2024-01-15").toISOString(),
    ...overrides,
  });
}

describe("ExperimentVisualizationsList", () => {
  it("renders loading skeleton", () => {
    const { container } = render(
      <ExperimentVisualizationsList visualizations={[]} experimentId={expId} isLoading />,
    );
    expect(container.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);
  });

  it("renders empty state", () => {
    render(
      <ExperimentVisualizationsList visualizations={[]} experimentId={expId} isLoading={false} />,
    );
    expect(screen.getByText("ui.messages.noVisualizations")).toBeInTheDocument();
  });

  it("renders visualization details", () => {
    render(<ExperimentVisualizationsList visualizations={[viz()]} experimentId={expId} />);
    expect(screen.getByText("Test Visualization")).toBeInTheDocument();
    expect(screen.getByText("A test desc")).toBeInTheDocument();
    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("charts.types.line")).toBeInTheDocument();
  });

  it("renders multiple items", () => {
    const items = ["A", "B", "C"].map((n, i) => viz({ id: `v-${i}`, name: n }));
    render(<ExperimentVisualizationsList visualizations={items} experimentId={expId} />);
    for (const n of ["A", "B", "C"]) expect(screen.getByText(n)).toBeInTheDocument();
  });

  it("links to correct visualization page", () => {
    render(
      <ExperimentVisualizationsList
        visualizations={[viz({ id: "viz-456" })]}
        experimentId={expId}
      />,
    );
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      `/platform/experiments/${expId}/analysis/visualizations/viz-456`,
    );
  });

  it.each([
    ["line", "charts.types.line"],
    ["lineplot", "charts.types.line"],
    ["scatter", "charts.types.scatter"],
    ["scatterplot", "charts.types.scatter"],
    ["customChart", "customChart"],
  ] as const)("displays chart type %s as '%s'", (chartType, expected) => {
    render(
      <ExperimentVisualizationsList
        visualizations={[viz({ chartType: chartType as "line" })]}
        experimentId={expId}
      />,
    );
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it.each([
    ["line", "charts.types.line", "bg-badge-published"],
    ["scatter", "charts.types.scatter", "bg-badge-stale"],
    ["unknown", "unknown", "bg-badge-archived"],
  ] as const)("badge for %s has class %s", (chartType, label, className) => {
    render(
      <ExperimentVisualizationsList
        visualizations={[viz({ chartType: chartType as "line" })]}
        experimentId={expId}
      />,
    );
    expect(screen.getByText(label)).toHaveClass(className);
  });

  it("shows truncated user ID when name is missing", () => {
    render(
      <ExperimentVisualizationsList
        visualizations={[viz({ createdBy: "user-1234567890", createdByName: undefined })]}
        experimentId={expId}
      />,
    );
    expect(screen.getByText("user-123...")).toBeInTheDocument();
  });

  it("displays formatted update date", () => {
    const date = formatDate(new Date("2024-03-15").toISOString());
    render(
      <ExperimentVisualizationsList
        visualizations={[viz({ updatedAt: new Date("2024-03-15").toISOString() })]}
        experimentId={expId}
      />,
    );
    expect(screen.getByText(`common.updated ${date}`)).toBeInTheDocument();
  });

  it("truncates description over 120 chars", () => {
    const long = "X".repeat(130);
    render(
      <ExperimentVisualizationsList
        visualizations={[viz({ description: long })]}
        experimentId={expId}
      />,
    );
    expect(screen.getByText(long.substring(0, 120) + "...")).toBeInTheDocument();
    expect(screen.queryByText(long)).not.toBeInTheDocument();
  });

  it.each([null, ""])("hides description when value is %s", (desc) => {
    const { container } = render(
      <ExperimentVisualizationsList
        visualizations={[viz({ description: desc as unknown as string })]}
        experimentId={expId}
      />,
    );
    expect(container.querySelector("p.text-gray-600")).not.toBeInTheDocument();
  });

  it("renders chevron icons for navigation", () => {
    const { container } = render(
      <ExperimentVisualizationsList
        visualizations={[viz({ id: "v1" }), viz({ id: "v2" })]}
        experimentId={expId}
      />,
    );
    expect(container.querySelectorAll(".lucide-chevron-right").length).toBe(2);
  });

  it("uses responsive grid layout", () => {
    const { container } = render(
      <ExperimentVisualizationsList visualizations={[viz(), viz(), viz()]} experimentId={expId} />,
    );
    const grid = container.querySelector(".grid");
    expect(grid).toHaveClass("grid-cols-1", "md:grid-cols-2", "lg:grid-cols-3");
  });
});
