import {
  createExperimentDataTable,
  createExperimentTable,
  createTableWidget,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { TableWidgetView } from "./table-widget";

function mountDataAndTables(opts: { tableName: string }) {
  server.mount(contract.experiments.getExperimentData, {
    body: [
      createExperimentDataTable({
        name: opts.tableName,
        page: 1,
        pageSize: 25,
        totalPages: 1,
        totalRows: 1,
        data: {
          columns: [
            { name: "time", type_name: "DOUBLE", type_text: "DOUBLE" },
            { name: "value", type_name: "DOUBLE", type_text: "DOUBLE" },
          ],
          rows: [{ id: "r1", time: 1, value: 10 }],
          totalRows: 1,
          truncated: false,
        },
      }),
    ],
  });
  server.mount(contract.experiments.getExperimentTables, {
    body: [createExperimentTable({ identifier: opts.tableName })],
  });
}

describe("TableWidgetView", () => {
  it("shows the empty state when no tableName is configured", () => {
    const widget = createTableWidget({
      config: { pageSize: 25, showTitle: true, showDescription: true, tableName: undefined },
    });
    render(<TableWidgetView widget={widget} experimentId="exp-1" />);
    expect(screen.getByText("widget.emptyTable")).toBeInTheDocument();
    expect(screen.getByText("widget.emptyTableDescription")).toBeInTheDocument();
  });

  it("renders the configured title in the header when showTitle is on", async () => {
    mountDataAndTables({ tableName: "raw_data" });
    const widget = createTableWidget({
      config: {
        pageSize: 25,
        showTitle: true,
        showDescription: true,
        tableName: "raw_data",
        title: "Daily Measurements",
      },
    });

    render(<TableWidgetView widget={widget} experimentId="exp-1" />);
    expect(await screen.findByRole("heading", { name: "Daily Measurements" })).toBeInTheDocument();
  });

  it("loads and shows row data fetched from the experiment-data endpoint", async () => {
    mountDataAndTables({ tableName: "raw_data" });
    const widget = createTableWidget({
      config: {
        pageSize: 25,
        showTitle: false,
        showDescription: false,
        tableName: "raw_data",
      },
    });

    render(<TableWidgetView widget={widget} experimentId="exp-1" />);
    await waitFor(() => expect(screen.getByText("10")).toBeInTheDocument());
  });
});
