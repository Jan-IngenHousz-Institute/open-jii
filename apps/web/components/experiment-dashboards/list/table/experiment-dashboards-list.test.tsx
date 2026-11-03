import { createExperimentDashboard, createRichTextWidget } from "@/test/factories";
import { openOnUrl } from "@/test/list-request";
import { render, screen, userEvent, within } from "@/test/test-utils";
import { formatDate } from "@/util/date";
import * as nav from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ExperimentDashboardsList from "./experiment-dashboards-list";

const PATH = "/en-US/platform/experiments/exp-1/dashboards";

const items = () => [
  createExperimentDashboard({ id: "d-old", name: "Beta", updatedAt: "2024-01-01T00:00:00.000Z" }),
  createExperimentDashboard({ id: "d-new", name: "Gamma", updatedAt: "2024-03-01T00:00:00.000Z" }),
  createExperimentDashboard({ id: "d-mid", name: "Alpha", updatedAt: "2024-02-01T00:00:00.000Z" }),
];

/** The data rows' names in display order; the first row is the header. */
const rowNames = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getByRole("link").textContent);

const sortButton = (column: "name" | "updated") =>
  screen.getByRole("button", { name: new RegExp(`^ui\\.labels\\.columns\\.${column}:`, "u") });

describe("ExperimentDashboardsList", () => {
  beforeEach(() => {
    openOnUrl(PATH, "");
    vi.mocked(nav.useRouter().replace).mockClear();
    vi.mocked(nav.useRouter().push).mockClear();
  });

  it("renders the column headers from translation keys", () => {
    render(<ExperimentDashboardsList dashboards={items()} experimentId="exp-1" />);
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

  it("renders each row's widget count, author and update date", () => {
    render(
      <ExperimentDashboardsList
        dashboards={[
          createExperimentDashboard({
            createdByName: "Jane Doe",
            updatedAt: "2024-03-10T00:00:00.000Z",
            widgets: [createRichTextWidget(), createRichTextWidget(), createRichTextWidget()],
          }),
        ]}
        experimentId="exp-1"
      />,
    );
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText(formatDate("2024-03-10T00:00:00.000Z"))).toBeInTheDocument();
  });

  it("names an author without a name by the fallback, never by an id prefix", () => {
    render(
      <ExperimentDashboardsList
        dashboards={[
          createExperimentDashboard({
            createdBy: "abcd1234-ef56-7890-abcd-ef1234567890",
            createdByName: undefined,
          }),
        ]}
        experimentId="exp-1"
      />,
    );
    expect(screen.getByText("common.unnamedAccount")).toBeInTheDocument();
    expect(screen.queryByText(/abcd1234/u)).not.toBeInTheDocument();
  });

  it("links each name to the dashboard, under the archive when isArchived is set", () => {
    const { unmount } = render(
      <ExperimentDashboardsList
        dashboards={[createExperimentDashboard({ id: "dash-1", name: "Photosynth" })]}
        experimentId="exp-1"
      />,
    );
    expect(screen.getByRole("link", { name: "Photosynth" })).toHaveAttribute(
      "href",
      "/platform/experiments/exp-1/dashboards/dash-1",
    );
    unmount();

    render(
      <ExperimentDashboardsList
        dashboards={[createExperimentDashboard({ id: "dash-1", name: "Photosynth" })]}
        experimentId="exp-1"
        isArchived
      />,
    );
    expect(screen.getByRole("link", { name: "Photosynth" })).toHaveAttribute(
      "href",
      "/platform/experiments-archive/exp-1/dashboards/dash-1",
    );
  });

  it("opens a dashboard from anywhere on its row", async () => {
    const user = userEvent.setup();
    render(
      <ExperimentDashboardsList
        dashboards={[
          createExperimentDashboard({ id: "dash-1", widgets: [createRichTextWidget()] }),
        ]}
        experimentId="exp-1"
      />,
    );

    await user.click(screen.getByText("1"));
    expect(nav.useRouter().push).toHaveBeenCalledWith(
      "/platform/experiments/exp-1/dashboards/dash-1",
    );
  });

  describe("sorting", () => {
    it("puts the newest update first, with neutral headers and no Reset sorting", () => {
      render(<ExperimentDashboardsList dashboards={items()} experimentId="exp-1" />);

      expect(rowNames()).toEqual(["Gamma", "Alpha", "Beta"]);
      // The default is not a sort anyone chose, so no header claims it.
      for (const header of screen.getAllByRole("columnheader")) {
        expect(header).not.toHaveAttribute("aria-sort");
      }
      expect(screen.queryByRole("button", { name: "common.resetSorting" })).toBeNull();
    });

    it("sorts only by name and update; widgets and user are not sortable", () => {
      render(<ExperimentDashboardsList dashboards={items()} experimentId="exp-1" />);

      expect(screen.queryByRole("button", { name: /^ui\.labels\.columns\.widgets/u })).toBeNull();
      expect(screen.queryByRole("button", { name: /^ui\.labels\.columns\.user/u })).toBeNull();
    });

    it("sorts by name from its header and writes the sort to the URL", async () => {
      const user = userEvent.setup();
      const replace = vi.mocked(nav.useRouter().replace);
      render(<ExperimentDashboardsList dashboards={items()} experimentId="exp-1" />);

      await user.click(sortButton("name"));
      expect(rowNames()).toEqual(["Alpha", "Beta", "Gamma"]);
      expect(sortButton("name").closest("th")).toHaveAttribute("aria-sort", "ascending");

      await user.click(sortButton("name"));
      expect(rowNames()).toEqual(["Gamma", "Beta", "Alpha"]);

      const sort = encodeURIComponent(
        JSON.stringify([{ field: "name", direction: "desc" }]),
      ).replace(/%2C/gu, ",");
      expect(replace).toHaveBeenLastCalledWith(`${PATH}?sort=${sort}`, { scroll: false });
    });

    it("adds a second sort on shift-click", async () => {
      const user = userEvent.setup();
      render(
        <ExperimentDashboardsList
          dashboards={[
            createExperimentDashboard({
              id: "a1",
              name: "Same",
              updatedAt: "2024-01-01T00:00:00.000Z",
            }),
            createExperimentDashboard({
              id: "a2",
              name: "Same",
              updatedAt: "2024-02-01T00:00:00.000Z",
            }),
          ]}
          experimentId="exp-1"
        />,
      );

      await user.click(sortButton("name"));
      await user.keyboard("{Shift>}");
      await user.click(sortButton("updated"));
      await user.keyboard("{/Shift}");

      expect(
        screen
          .getAllByRole("row")
          .slice(1)
          .map((row) => within(row).getByText(/2024/u).textContent),
      ).toEqual([formatDate("2024-01-01T00:00:00.000Z"), formatDate("2024-02-01T00:00:00.000Z")]);
      expect(sortButton("updated")).toHaveAccessibleName(/common\.sortSecondary/u);
    });

    it("opens on the sort a shared link carries, and Reset sorting returns to the default", async () => {
      openOnUrl(
        PATH,
        `sort=${encodeURIComponent(JSON.stringify([{ field: "updatedAt", direction: "asc" }]))}`,
      );
      const user = userEvent.setup();
      render(<ExperimentDashboardsList dashboards={items()} experimentId="exp-1" />);

      expect(rowNames()).toEqual(["Beta", "Alpha", "Gamma"]);
      await user.click(screen.getByRole("button", { name: "common.resetSorting" }));

      expect(rowNames()).toEqual(["Gamma", "Alpha", "Beta"]);
      expect(screen.queryByRole("button", { name: "common.resetSorting" })).toBeNull();
    });
  });
});
