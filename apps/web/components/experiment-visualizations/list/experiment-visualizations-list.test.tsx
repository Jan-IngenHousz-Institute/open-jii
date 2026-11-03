import { createVisualization } from "@/test/factories";
import { openOnUrl } from "@/test/list-request";
import { render, screen, userEvent, within } from "@/test/test-utils";
import { formatDate } from "@/util/date";
import * as nav from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExperimentVisualization } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";

import ExperimentVisualizationsList from "./experiment-visualizations-list";

const expId = "exp-123";
const PATH = `/en-US/platform/experiments/${expId}/analysis/visualizations`;

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

const items = () => [
  viz({ id: "v-old", name: "Beta", updatedAt: new Date("2024-01-01").toISOString() }),
  viz({ id: "v-new", name: "Gamma", updatedAt: new Date("2024-03-01").toISOString() }),
  viz({ id: "v-mid", name: "Alpha", updatedAt: new Date("2024-02-01").toISOString() }),
];

/** The data rows' names in display order; the first row is the header. */
const rowNames = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getByRole("link").textContent);

const sortButton = (column: "name" | "updated") =>
  screen.getByRole("button", { name: new RegExp(`^ui\\.labels\\.columns\\.${column}:`, "u") });

describe("ExperimentVisualizationsList", () => {
  beforeEach(() => {
    openOnUrl(PATH, "");
    vi.mocked(nav.useRouter().replace).mockClear();
  });

  it("renders skeleton rows and no count when loading", () => {
    render(<ExperimentVisualizationsList visualizations={[]} experimentId={expId} isLoading />);
    expect(document.querySelectorAll('[class*="animate-pulse"]').length).toBeGreaterThan(0);
    expect(screen.queryByText("ui.labels.listCount")).toBeNull();
  });

  it("counts the charts above the table", () => {
    render(<ExperimentVisualizationsList visualizations={[]} experimentId={expId} />);
    expect(screen.getByText("ui.labels.listCount")).toBeInTheDocument();
  });

  it("renders the empty state with a docs link, and no link on an archived experiment", () => {
    const { unmount } = render(
      <ExperimentVisualizationsList visualizations={[]} experimentId={expId} isLoading={false} />,
    );
    expect(screen.getByText("ui.messages.noVisualizations")).toBeInTheDocument();
    expect(screen.getByRole("link")).toBeInTheDocument();
    unmount();

    render(<ExperimentVisualizationsList visualizations={[]} experimentId={expId} isArchived />);
    expect(screen.getByText("ui.messages.noVisualizations")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
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

  it("links the name cell to the chart, under the archive when isArchived is set", () => {
    const { unmount } = render(
      <ExperimentVisualizationsList
        visualizations={[viz({ id: "viz-456" })]}
        experimentId={expId}
      />,
    );
    expect(screen.getByRole("link", { name: "Test Visualization" })).toHaveAttribute(
      "href",
      `/platform/experiments/${expId}/analysis/visualizations/viz-456`,
    );
    unmount();

    render(
      <ExperimentVisualizationsList
        visualizations={[viz({ id: "viz-9" })]}
        experimentId={expId}
        isArchived
      />,
    );
    expect(screen.getByRole("link", { name: "Test Visualization" })).toHaveAttribute(
      "href",
      `/platform/experiments-archive/${expId}/analysis/visualizations/viz-9`,
    );
  });

  it("names an author without a name by the fallback, never by an id prefix", () => {
    render(
      <ExperimentVisualizationsList
        visualizations={[viz({ createdBy: "user-1234567890", createdByName: undefined })]}
        experimentId={expId}
      />,
    );
    expect(screen.getByText("common.unnamedAccount")).toBeInTheDocument();
    expect(screen.queryByText(/user-123/u)).not.toBeInTheDocument();
  });

  describe("the type pill", () => {
    const renderType = (chartType: ExperimentVisualization["chartType"]) =>
      render(
        <ExperimentVisualizationsList visualizations={[viz({ chartType })]} experimentId={expId} />,
      );

    it.each(["line", "scatter", "bar", "area", "dot-plot", "lollipop", "bubble", "pie"] as const)(
      "renders the basic-family badge for chartType=%s",
      (chartType) => {
        renderType(chartType);
        expect(screen.getByText(`workspace.charts.types.${chartType}`)).toHaveClass(
          "bg-status-published",
        );
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
      renderType(chartType);
      expect(screen.getByText(labelKey)).toHaveClass("bg-status-stale");
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
      renderType(chartType);
      expect(screen.getByText(labelKey)).toHaveClass("bg-status-archived");
    });
  });

  describe("sorting", () => {
    it("puts the newest update first by default, with no header claiming it", () => {
      render(<ExperimentVisualizationsList visualizations={items()} experimentId={expId} />);

      expect(rowNames()).toEqual(["Gamma", "Alpha", "Beta"]);
      for (const header of screen.getAllByRole("columnheader")) {
        expect(header).not.toHaveAttribute("aria-sort");
      }
      expect(screen.queryByRole("button", { name: "common.resetSorting" })).toBeNull();
      expect(screen.queryByRole("button", { name: /^ui\.labels\.columns\.type/u })).toBeNull();
    });

    it("sorts by update from its header and writes the sort to the URL", async () => {
      const user = userEvent.setup();
      const replace = vi.mocked(nav.useRouter().replace);
      render(<ExperimentVisualizationsList visualizations={items()} experimentId={expId} />);

      await user.click(sortButton("updated"));

      expect(rowNames()).toEqual(["Beta", "Alpha", "Gamma"]);
      const sort = encodeURIComponent(
        JSON.stringify([{ field: "updatedAt", direction: "asc" }]),
      ).replace(/%2C/gu, ",");
      expect(replace).toHaveBeenLastCalledWith(`${PATH}?sort=${sort}`, { scroll: false });
    });

    it("offers Reset sorting once a sort is chosen, which returns to the default", async () => {
      const user = userEvent.setup();
      render(<ExperimentVisualizationsList visualizations={items()} experimentId={expId} />);

      await user.click(sortButton("name"));
      expect(rowNames()).toEqual(["Alpha", "Beta", "Gamma"]);

      await user.click(screen.getByRole("button", { name: "common.resetSorting" }));
      expect(rowNames()).toEqual(["Gamma", "Alpha", "Beta"]);
    });
  });
});
