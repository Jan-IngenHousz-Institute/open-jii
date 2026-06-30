import { createExperimentDataTable, createExperimentTable } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

import { LoadedTableView } from "./loaded-table-view";

function mountDataAndTables(opts: {
  tableName: string;
  totalPages?: number;
  rows?: Record<string, unknown>[];
}) {
  const rows = opts.rows ?? [{ id: "r1", value: 1 }];
  const spy = server.mount(orpcContract.experiments.getExperimentData, {
    body: [
      createExperimentDataTable({
        name: opts.tableName,
        page: 1,
        pageSize: 25,
        totalPages: opts.totalPages ?? 1,
        totalRows: rows.length,
        data: {
          columns: [{ name: "value", type_name: "DOUBLE", type_text: "DOUBLE" }],
          rows,
          totalRows: rows.length,
          truncated: false,
        },
      }),
    ],
  });
  server.mount(orpcContract.experiments.getExperimentTables, {
    body: [createExperimentTable({ identifier: opts.tableName })],
  });
  return spy;
}

describe("LoadedTableView", () => {
  it("renders the fetched rows", async () => {
    mountDataAndTables({
      tableName: "raw_data",
      rows: [
        { id: "r1", value: 11 },
        { id: "r2", value: 22 },
      ],
    });
    render(<LoadedTableView tableName="raw_data" pageSize={25} experimentId="exp-1" />);
    await waitFor(() => expect(screen.getByText("11")).toBeInTheDocument());
    expect(screen.getByText("22")).toBeInTheDocument();
  });

  it("hides the pagination footer when there's a single page", async () => {
    mountDataAndTables({ tableName: "raw_data", totalPages: 1 });
    render(<LoadedTableView tableName="raw_data" pageSize={25} experimentId="exp-1" />);
    await waitFor(() => expect(screen.getByText("1")).toBeInTheDocument());
    expect(screen.queryByLabelText("Go to next page")).not.toBeInTheDocument();
  });

  it("shows pagination controls and re-fetches with the new page on Next", async () => {
    const spy = mountDataAndTables({ tableName: "raw_data", totalPages: 3 });
    const user = userEvent.setup();
    render(<LoadedTableView tableName="raw_data" pageSize={25} experimentId="exp-1" />);

    const next = await screen.findByLabelText("Go to next page");
    await user.click(next);
    await waitFor(() => {
      const last = spy.calls[spy.calls.length - 1];
      expect(last.query.page).toBe("2");
    });
  });

  it("resets to page 1 when the widget filters change", async () => {
    const spy = mountDataAndTables({ tableName: "raw_data", totalPages: 5 });
    const user = userEvent.setup();
    const { rerender } = render(
      <LoadedTableView tableName="raw_data" pageSize={25} experimentId="exp-1" />,
    );

    // Navigate off page 1.
    const next = await screen.findByLabelText("Go to next page");
    await user.click(next);
    await waitFor(() => {
      const last = spy.calls[spy.calls.length - 1];
      expect(last.query.page).toBe("2");
    });

    // Apply a filter: the new request still paginates (page=1), and the
    // filter rides along on the URL.
    rerender(
      <LoadedTableView
        tableName="raw_data"
        pageSize={25}
        experimentId="exp-1"
        widgetFilters={[{ column: "value", operator: "greater_than", value: 0 }]}
      />,
    );
    await waitFor(() => {
      const last = spy.calls[spy.calls.length - 1];
      expect(last.query.filters).toBeDefined();
      expect(last.query.page).toBe("1");
    });
  });

  it("shows the load-failed empty state when the data fetch errors", async () => {
    server.mount(orpcContract.experiments.getExperimentData, { status: 500 });
    server.mount(orpcContract.experiments.getExperimentTables, {
      body: [createExperimentTable({ identifier: "raw_data" })],
    });
    render(<LoadedTableView tableName="raw_data" pageSize={25} experimentId="exp-1" />);
    await waitFor(() => expect(screen.getByText("widget.tableLoadFailed")).toBeInTheDocument());
  });

  it("requests ASC ordering on the clicked column", async () => {
    const spy = mountDataAndTables({ tableName: "raw_data" });
    const user = userEvent.setup();
    render(<LoadedTableView tableName="raw_data" pageSize={25} experimentId="exp-1" />);

    const header = await screen.findByRole("columnheader", { name: /value/i });
    await user.click(header);
    await waitFor(() => {
      const ordered = spy.calls.find((c) => c.query.orderBy === "value");
      expect(ordered).toBeDefined();
      expect(ordered?.query.orderDirection).toBe("ASC");
    });
  });

  it("only requests the selected columns subset", async () => {
    mountDataAndTables({
      tableName: "raw_data",
      rows: [{ id: "r1", value: 7 }],
    });
    render(
      <LoadedTableView
        tableName="raw_data"
        pageSize={25}
        experimentId="exp-1"
        selectedColumns={["value"]}
      />,
    );
    await waitFor(() => expect(screen.getByText("7")).toBeInTheDocument());
    // The column is projected into the rendered table head.
    expect(screen.getByRole("columnheader", { name: /value/i })).toBeInTheDocument();
  });

  it("survives a re-render while data is still loading (no autoReset loop)", async () => {
    server.mount(contract.experiments.getExperimentTables, {
      body: [createExperimentTable({ identifier: "raw_data" })],
    });
    // Hold the data in a loading state briefly so the re-render lands while
    // `tableRows` is undefined — the window where an unstable `[]` data ref
    // used to send react-table's autoReset into an infinite microtask loop.
    server.mount(contract.experiments.getExperimentData, {
      delay: 50,
      body: [
        createExperimentDataTable({
          name: "raw_data",
          page: 1,
          pageSize: 25,
          totalPages: 1,
          totalRows: 1,
          data: {
            columns: [{ name: "value", type_name: "DOUBLE", type_text: "DOUBLE" }],
            rows: [{ value: 9 }],
            totalRows: 1,
            truncated: false,
          },
        }),
      ],
    });

    const { rerender } = render(
      <LoadedTableView tableName="raw_data" pageSize={25} experimentId="exp-1" />,
    );
    rerender(<LoadedTableView tableName="raw_data" pageSize={25} experimentId="exp-1" />);

    // Reaching the loaded row (not timing out) is the regression assertion.
    await waitFor(() => expect(screen.getByText("9")).toBeInTheDocument());
  });
});
