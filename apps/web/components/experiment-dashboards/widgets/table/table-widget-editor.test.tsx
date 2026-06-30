import {
  createExperimentDataTable,
  createExperimentTable,
  createTableWidget,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

import { TableWidgetEditor } from "./table-widget-editor";

describe("TableWidgetEditor", () => {
  it("renders the editor's pick-a-table hint when no tableName is set", () => {
    const widget = createTableWidget({
      config: { pageSize: 25, showTitle: true, showDescription: true, tableName: undefined },
    });
    render(<TableWidgetEditor widget={widget} experimentId="exp-1" />);
    expect(screen.getByText("editor.tableConfig.pickTable")).toBeInTheDocument();
    expect(screen.getByText("editor.tableConfig.pickHint")).toBeInTheDocument();
  });

  it("delegates to the view component once a table is selected", async () => {
    server.mount(orpcContract.experiments.getExperimentData, {
      body: [
        createExperimentDataTable({
          name: "raw_data",
          page: 1,
          pageSize: 25,
          totalPages: 1,
          totalRows: 1,
          data: {
            columns: [{ name: "value", type_name: "DOUBLE", type_text: "DOUBLE" }],
            rows: [{ id: "r1", value: 42 }],
            totalRows: 1,
            truncated: false,
          },
        }),
      ],
    });
    server.mount(orpcContract.experiments.getExperimentTables, {
      body: [createExperimentTable({ identifier: "raw_data" })],
    });

    const widget = createTableWidget({
      config: {
        pageSize: 25,
        showTitle: false,
        showDescription: false,
        tableName: "raw_data",
      },
    });

    render(<TableWidgetEditor widget={widget} experimentId="exp-1" />);
    await waitFor(() => expect(screen.getByText("42")).toBeInTheDocument());
  });
});
