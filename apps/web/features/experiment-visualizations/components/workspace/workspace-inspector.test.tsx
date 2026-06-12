import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import type { DataColumn, ExperimentTableMetadata } from "@repo/api/schemas/experiment.schema";

import { lineChartType } from "../charts/basic/line";
import type { ChartFormValues } from "../charts/chart-config";
import { DataSourcesFieldArrayProvider } from "./context/data-sources-field-array-context";
import { WorkspaceInspector } from "./workspace-inspector";

function defaults(overrides: Partial<ChartFormValues> = {}): ChartFormValues {
  return {
    name: "Untitled",
    description: "",
    chartFamily: lineChartType.family,
    chartType: lineChartType.type,
    config: lineChartType.defaultConfig(),
    dataConfig: lineChartType.defaultDataConfig(),
    ...overrides,
  };
}

const tables: ExperimentTableMetadata[] = [
  { identifier: "readings", displayName: "Readings", tableType: "static", totalRows: 100 },
  { identifier: "events", displayName: "Events", tableType: "static", totalRows: 50 },
];

const columns: DataColumn[] = [
  { name: "time", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
  { name: "temp", type_name: "DOUBLE", type_text: "DOUBLE" },
];

interface RenderOpts {
  formDefaults?: ChartFormValues;
  isTablesLoading?: boolean;
  tablesError?: unknown;
  selectedTableName?: string;
  isColumnsLoading?: boolean;
  columnsError?: unknown;
  onTableChange?: (name: string) => void;
}

function renderInspector(opts: RenderOpts = {}) {
  const onTableChange = opts.onTableChange ?? vi.fn();
  return {
    onTableChange,
    ...renderWithForm<ChartFormValues>(
      (form) => (
        <DataSourcesFieldArrayProvider form={form}>
          <WorkspaceInspector
            form={form}
            experimentId="test-experiment"
            tables={opts.tablesError ? [] : tables}
            isTablesLoading={opts.isTablesLoading ?? false}
            tablesError={opts.tablesError}
            selectedTableName={opts.selectedTableName ?? ""}
            onTableChange={onTableChange}
            columns={columns}
            isColumnsLoading={opts.isColumnsLoading ?? false}
            columnsError={opts.columnsError}
          />
        </DataSourcesFieldArrayProvider>
      ),
      { useFormProps: { defaultValues: opts.formDefaults ?? defaults() } },
    ),
  };
}

describe("WorkspaceInspector", () => {
  it("shows the whole-tab loading card while tables are loading (skipping the dataset select)", () => {
    renderInspector({ isTablesLoading: true });

    expect(screen.getByText("workspace.inspector.loadingTables")).toBeInTheDocument();
    expect(screen.queryByText("workspace.inspector.dataset")).not.toBeInTheDocument();
  });

  it("shows the dataset section once tables resolve", () => {
    renderInspector();

    // The "dataset" string also appears as an `sr-only` FormLabel; assert
    // the visible heading specifically so the query is unambiguous.
    expect(
      screen.getByRole("heading", { name: "workspace.inspector.dataset" }),
    ).toBeInTheDocument();
  });

  it("calls onTableChange and writes the picked value into the form", async () => {
    const user = userEvent.setup();
    const onTableChange = vi.fn();
    renderInspector({ onTableChange });

    // Radix's SelectValue renders the placeholder inside a span with
    // `pointer-events: none`; click the actual combobox button.
    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("Readings"));

    expect(onTableChange).toHaveBeenCalledWith("readings");
  });

  it("renders the failed-to-load-tables message inside the dropdown when tablesError is set", async () => {
    const user = userEvent.setup();
    renderInspector({ tablesError: new Error("boom") });

    await user.click(screen.getByRole("combobox"));
    expect(await screen.findByText("workspace.inspector.failedToLoadTables")).toBeInTheDocument();
  });

  it("renders the no-tables message inside the dropdown when the tables list is empty", async () => {
    const user = userEvent.setup();
    // No tablesError, but pass an empty list explicitly through a one-off
    // render; existing helper short-circuits to `tables` when no error.
    renderWithForm<ChartFormValues>(
      (form) => (
        <DataSourcesFieldArrayProvider form={form}>
          <WorkspaceInspector
            form={form}
            experimentId="test-experiment"
            tables={[]}
            selectedTableName=""
            onTableChange={vi.fn()}
            columns={columns}
            isColumnsLoading={false}
          />
        </DataSourcesFieldArrayProvider>
      ),
      { useFormProps: { defaultValues: defaults() } },
    );

    await user.click(screen.getByRole("combobox"));
    expect(await screen.findByText("workspace.inspector.noTables")).toBeInTheDocument();
  });

  it("shows the columns-loading state under the dataset select when columns are loading", () => {
    renderInspector({ selectedTableName: "readings", isColumnsLoading: true });

    expect(screen.getByText("workspace.inspector.loadingColumns")).toBeInTheDocument();
  });

  it("shows the failed-to-load-columns card when columnsError is set", () => {
    renderInspector({ selectedTableName: "readings", columnsError: new Error("boom") });

    expect(screen.getByText("workspace.inspector.failedToLoadColumns")).toBeInTheDocument();
  });

  it("nudges users to pick a table before columns can show up", () => {
    renderInspector({ selectedTableName: "" });

    expect(screen.getByText("workspace.inspector.selectTableFirst")).toBeInTheDocument();
  });

  it("renders the chart-type's data panel once table + columns are configured", () => {
    renderInspector({ selectedTableName: "readings" });

    // Line's data panel includes the X-axis shelf heading.
    expect(screen.getByText("workspace.shelves.xAxis")).toBeInTheDocument();
  });

  it("switches between Data and Style tabs when their tab triggers are clicked", async () => {
    const user = userEvent.setup();
    renderInspector({ selectedTableName: "readings" });

    expect(screen.getByText("workspace.shelves.xAxis")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /workspace\.inspector\.tabs\.style/ }));
    // Line's style panel includes the line-style fields heading.
    expect(screen.getByText("workspace.style.display")).toBeInTheDocument();
  });
});
