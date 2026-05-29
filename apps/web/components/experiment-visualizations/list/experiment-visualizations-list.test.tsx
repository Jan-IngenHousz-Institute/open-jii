import { createVisualization } from "@/test/factories";
import { render, screen, within } from "@/test/test-utils";
import { formatDate } from "@/util/date";
import { describe, it, expect } from "vitest";

import type { ExperimentVisualization } from "@repo/api/schemas/experiment.schema";

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
  it("renders skeleton rows when loading", () => {
    render(<ExperimentVisualizationsList visualizations={[]} experimentId={expId} isLoading />);
    expect(document.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);
  });

  it("renders empty state when no visualizations", () => {
    render(
      <ExperimentVisualizationsList visualizations={[]} experimentId={expId} isLoading={false} />,
    );
    expect(screen.getByText("ui.messages.noVisualizations")).toBeInTheDocument();
  });

  it("renders all column headers", () => {
    render(<ExperimentVisualizationsList visualizations={[viz()]} experimentId={expId} />);
    expect(screen.getByText("ui.labels.columns.name")).toBeInTheDocument();
    expect(screen.getByText("ui.labels.columns.type")).toBeInTheDocument();
    expect(screen.getByText("ui.labels.columns.user")).toBeInTheDocument();
    expect(screen.getByText("ui.labels.columns.updated")).toBeInTheDocument();
  });

  it("renders the row's name, type, user, and date", () => {
    render(<ExperimentVisualizationsList visualizations={[viz()]} experimentId={expId} />);
    expect(screen.getByText("Test Visualization")).toBeInTheDocument();
    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("workspace.charts.types.line")).toBeInTheDocument();
    expect(screen.getByText(formatDate(new Date("2024-01-15").toISOString()))).toBeInTheDocument();
  });

  it("renders multiple rows, sorted by updatedAt desc", () => {
    const items = [
      viz({ id: "v-old", name: "Older", updatedAt: new Date("2024-01-01").toISOString() }),
      viz({ id: "v-new", name: "Newer", updatedAt: new Date("2024-03-01").toISOString() }),
      viz({ id: "v-mid", name: "Middle", updatedAt: new Date("2024-02-01").toISOString() }),
    ];
    render(<ExperimentVisualizationsList visualizations={items} experimentId={expId} />);
    const rows = screen.getAllByRole("row");
    // First row is the header; data rows follow.
    expect(within(rows[1]).getByText("Newer")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Middle")).toBeInTheDocument();
    expect(within(rows[3]).getByText("Older")).toBeInTheDocument();
  });

  it("links the name cell to the visualization page", () => {
    render(
      <ExperimentVisualizationsList
        visualizations={[viz({ id: "viz-456" })]}
        experimentId={expId}
      />,
    );
    const link = screen.getByRole("link", { name: "Test Visualization" });
    expect(link).toHaveAttribute(
      "href",
      `/platform/experiments/${expId}/analysis/visualizations/viz-456`,
    );
  });

  it.each([
    ["line", "workspace.charts.types.line"],
    ["scatter", "workspace.charts.types.scatter"],
  ] as const)("displays chart type %s as '%s'", (chartType, expected) => {
    render(
      <ExperimentVisualizationsList visualizations={[viz({ chartType })]} experimentId={expId} />,
    );
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it.each([
    // Both line and scatter are in the "basic" family. Color is family-keyed
    // so the list scales to 20+ chart types without per-type bookkeeping.
    ["line", "workspace.charts.types.line", "bg-badge-published"],
    ["scatter", "workspace.charts.types.scatter", "bg-badge-published"],
  ] as const)("type pill for %s carries class %s", (chartType, label, className) => {
    render(
      <ExperimentVisualizationsList visualizations={[viz({ chartType })]} experimentId={expId} />,
    );
    expect(screen.getByText(label)).toHaveClass(className);
  });

  it("falls back to a truncated user id when name is missing", () => {
    render(
      <ExperimentVisualizationsList
        visualizations={[viz({ createdBy: "user-1234567890", createdByName: undefined })]}
        experimentId={expId}
      />,
    );
    expect(screen.getByText("user-123…")).toBeInTheDocument();
  });

  it("uses experiments-archive base path when isArchived is set", () => {
    render(
      <ExperimentVisualizationsList
        visualizations={[viz({ id: "viz-9" })]}
        experimentId={expId}
        isArchived
      />,
    );
    const link = screen.getByRole("link", { name: "Test Visualization" });
    expect(link).toHaveAttribute(
      "href",
      `/platform/experiments-archive/${expId}/analysis/visualizations/viz-9`,
    );
  });
});
