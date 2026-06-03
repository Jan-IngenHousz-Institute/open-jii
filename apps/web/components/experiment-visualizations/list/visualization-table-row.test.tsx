import { createVisualization } from "@/test/factories";
import { server } from "@/test/msw/server";
import { assertExists, render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";
import type { ExperimentVisualization } from "@repo/api/schemas/experiment.schema";
import { Table, TableBody } from "@repo/ui/components/table";

import { VisualizationTableRow } from "./visualization-table-row";

function viz(overrides: Partial<ExperimentVisualization> = {}): ExperimentVisualization {
  return createVisualization({
    id: "viz-7",
    name: "My Plot",
    chartType: "line",
    experimentId: "exp-1",
    createdBy: "user-abcdef1234567890",
    createdByName: "Jane Doe",
    updatedAt: "2025-02-03T00:00:00.000Z",
    ...overrides,
  });
}

function renderRow(
  props: {
    visualization?: ExperimentVisualization;
    experimentId?: string;
    basePath?: string;
  } = {},
) {
  return render(
    <Table>
      <TableBody>
        <VisualizationTableRow
          visualization={props.visualization ?? viz()}
          experimentId={props.experimentId ?? "exp-1"}
          basePath={props.basePath ?? "experiments"}
        />
      </TableBody>
    </Table>,
  );
}

describe("VisualizationTableRow", () => {
  it("links the name cell to the visualization view route under the given basePath", () => {
    renderRow({ basePath: "experiments-archive" });
    const link = screen.getByRole("link", { name: "My Plot" });
    expect(link).toHaveAttribute(
      "href",
      "/platform/experiments-archive/exp-1/analysis/visualizations/viz-7",
    );
  });

  it("renders the createdByName when present", () => {
    renderRow({ visualization: viz({ createdByName: "Alice" }) });
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("falls back to a truncated user id when createdByName is missing", () => {
    renderRow({ visualization: viz({ createdByName: undefined, createdBy: "user-9876543210" }) });
    expect(screen.getByText("user-987…")).toBeInTheDocument();
  });

  it("shows the registered chart type label and family-keyed badge class", () => {
    renderRow({ visualization: viz({ chartType: "line" }) });
    const pill = screen.getByText("workspace.charts.types.line");
    expect(pill).toHaveClass("bg-badge-published");
  });

  it.each(["bar", "area", "dot-plot", "lollipop", "bubble", "pie"] as const)(
    "renders the basic-family badge for chartType=%s",
    (chartType) => {
      renderRow({ visualization: viz({ chartType }) });
      // Labels use camelCased keys for hyphenated types (workspace.charts.types.dot-plot).
      const key = `workspace.charts.types.${chartType}`;
      expect(screen.getByText(key)).toHaveClass("bg-badge-published");
    },
  );

  it.each([
    ["histogram", "workspace.charts.types.histogram"],
    ["box-plot", "workspace.charts.types.boxPlot"],
    ["violin-plot", "workspace.charts.types.violinPlot"],
    ["density-plot", "workspace.charts.types.densityPlot"],
    ["ridge-plot", "workspace.charts.types.ridgePlot"],
    ["histogram-2d", "workspace.charts.types.histogram2d"],
    ["density-plot-2d", "workspace.charts.types.densityPlot2d"],
    ["spc-control-chart", "workspace.charts.types.spcControlChart"],
  ] as const)("renders the statistical-family badge for chartType=%s", (chartType, labelKey) => {
    renderRow({ visualization: viz({ chartType }) });
    expect(screen.getByText(labelKey)).toHaveClass("bg-badge-stale");
  });

  it.each([
    ["heatmap", "workspace.charts.types.heatmap"],
    ["contour", "workspace.charts.types.contour"],
    ["correlation-matrix", "workspace.charts.types.correlationMatrix"],
    ["parallel-coordinates", "workspace.charts.types.parallelCoordinates"],
    ["radar", "workspace.charts.types.radar"],
    ["polar", "workspace.charts.types.polar"],
    ["wind-rose", "workspace.charts.types.windRose"],
    ["ternary", "workspace.charts.types.ternary"],
    ["alluvial", "workspace.charts.types.alluvial"],
    ["carpet", "workspace.charts.types.carpet"],
  ] as const)("renders the scientific-family badge for chartType=%s", (chartType, labelKey) => {
    renderRow({ visualization: viz({ chartType }) });
    expect(screen.getByText(labelKey)).toHaveClass("bg-badge-archived");
  });

  it("opens the confirm dialog when the delete menu item is selected", async () => {
    const user = userEvent.setup();
    renderRow();
    await user.click(screen.getByRole("button", { name: "ui.actions.moreActions" }));
    await user.click(await screen.findByText("ui.actions.delete"));
    expect(screen.getByRole("alertdialog", { name: "ui.actions.delete" })).toBeInTheDocument();
  });

  it("invokes the delete endpoint with the visualization id when confirmed", async () => {
    const user = userEvent.setup();
    const spy = server.mount(contract.experiments.deleteExperimentVisualization);
    renderRow();
    await user.click(screen.getByRole("button", { name: "ui.actions.moreActions" }));
    await user.click(await screen.findByText("ui.actions.delete"));
    const dialog = screen.getByRole("alertdialog");
    const confirm = within(dialog).getAllByText("ui.actions.delete").pop();
    assertExists(confirm);
    await user.click(confirm);
    await waitFor(() => {
      expect(spy.params.id).toBe("exp-1");
      expect(spy.params.visualizationId).toBe("viz-7");
    });
  });
});
