import { createExperimentDashboard, createRichTextWidget } from "@/test/factories";
import { render, screen, within } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import ExperimentDashboardsList from "./experiment-dashboards-list";

// DashboardTableRow has its own thorough tests; this suite focuses on the
// surrounding list (sorting, headers, empty / loading branches).
vi.mock("./dashboard-table-row", () => ({
  DashboardTableRow: ({
    dashboard,
    basePath,
  }: {
    dashboard: { id: string; name: string };
    basePath: string;
  }) => (
    <tr data-testid="row" data-base={basePath}>
      <td>
        <a href={`/${basePath}/${dashboard.id}`}>{dashboard.name}</a>
      </td>
    </tr>
  ),
}));

describe("ExperimentDashboardsList", () => {
  it("renders the column headers from translation keys", () => {
    render(
      <ExperimentDashboardsList dashboards={[createExperimentDashboard()]} experimentId="exp-1" />,
    );
    expect(screen.getByText("ui.labels.columns.name")).toBeInTheDocument();
    expect(screen.getByText("ui.labels.columns.widgets")).toBeInTheDocument();
    expect(screen.getByText("ui.labels.columns.user")).toBeInTheDocument();
    expect(screen.getByText("ui.labels.columns.updated")).toBeInTheDocument();
  });

  it("shows the empty-state copy when not loading and the list is empty", () => {
    render(<ExperimentDashboardsList dashboards={[]} experimentId="exp-1" />);
    expect(screen.getByText("ui.messages.emptyDashboard")).toBeInTheDocument();
  });

  it("renders skeleton rows (not the empty state) when isLoading is true", () => {
    const { container } = render(
      <ExperimentDashboardsList dashboards={[]} experimentId="exp-1" isLoading />,
    );
    expect(screen.queryByText("ui.messages.emptyDashboard")).toBeNull();
    expect(container.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);
  });

  it("sorts dashboards by updatedAt desc", () => {
    const items = [
      createExperimentDashboard({
        name: "Older",
        updatedAt: "2024-01-01T00:00:00.000Z",
        widgets: [createRichTextWidget()],
      }),
      createExperimentDashboard({
        name: "Newer",
        updatedAt: "2024-03-01T00:00:00.000Z",
        widgets: [createRichTextWidget()],
      }),
      createExperimentDashboard({
        name: "Middle",
        updatedAt: "2024-02-01T00:00:00.000Z",
        widgets: [createRichTextWidget()],
      }),
    ];

    render(<ExperimentDashboardsList dashboards={items} experimentId="exp-1" />);

    const rows = screen.getAllByTestId("row");
    expect(within(rows[0]).getByText("Newer")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Middle")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Older")).toBeInTheDocument();
  });

  it("passes the archived basePath to rows when isArchived is set", () => {
    render(
      <ExperimentDashboardsList
        dashboards={[createExperimentDashboard()]}
        experimentId="exp-1"
        isArchived
      />,
    );
    const row = screen.getByTestId("row");
    expect(row.getAttribute("data-base")).toBe("experiments-archive");
  });

  it("passes the default basePath when isArchived is not set", () => {
    render(
      <ExperimentDashboardsList dashboards={[createExperimentDashboard()]} experimentId="exp-1" />,
    );
    expect(screen.getByTestId("row").getAttribute("data-base")).toBe("experiments");
  });
});
