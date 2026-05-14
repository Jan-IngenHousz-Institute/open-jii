import { createExperimentTable } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { useForm, FormProvider } from "react-hook-form";
import type { UseFormReturn } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import { lineChartType } from "../../charts/basic/line";
import type { ChartFormValues } from "../../charts/chart-config";
import { DataSourcesFieldArrayProvider } from "../context/data-sources-field-array-context";
import { DataTabContent } from "./data-tab-content";

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

interface HarnessOptions {
  selectedTableName?: string;
  columns?: DataColumn[];
  isTablesLoading?: boolean;
  isColumnsLoading?: boolean;
  tablesError?: unknown;
  columnsError?: unknown;
  tables?: ReturnType<typeof createExperimentTable>[];
  formDefaults?: ChartFormValues;
}

function Harness({
  selectedTableName = "",
  columns = [],
  isTablesLoading = false,
  isColumnsLoading = false,
  tablesError,
  columnsError,
  tables = [createExperimentTable({ identifier: "readings", displayName: "Readings" })],
  formDefaults = defaults(),
}: HarnessOptions) {
  const form: UseFormReturn<ChartFormValues> = useForm<ChartFormValues>({
    defaultValues: formDefaults,
  });
  return (
    <FormProvider {...form}>
      <DataSourcesFieldArrayProvider form={form}>
        <DataTabContent
          form={form}
          experimentId="exp-1"
          tables={tables}
          isTablesLoading={isTablesLoading}
          tablesError={tablesError}
          selectedTableName={selectedTableName}
          onTableChange={vi.fn()}
          columns={columns}
          isColumnsLoading={isColumnsLoading}
          columnsError={columnsError}
        />
      </DataSourcesFieldArrayProvider>
    </FormProvider>
  );
}

function mountDistinct() {
  server.mount(contract.experiments.getDistinctColumnValues, {
    body: { values: [], truncated: false },
  });
}

describe("DataTabContent", () => {
  it("renders the loading-tables card when isTablesLoading is true", () => {
    mountDistinct();
    render(<Harness isTablesLoading />);
    expect(screen.getByText("workspace.inspector.loadingTables")).toBeInTheDocument();
  });

  it("renders the dataset heading and select once tables load", () => {
    mountDistinct();
    render(<Harness />);
    expect(
      screen.getByRole("heading", { name: "workspace.inspector.dataset" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("prompts the user to pick a table when none is selected", () => {
    mountDistinct();
    render(<Harness />);
    expect(screen.getByText("workspace.inspector.selectTableFirst")).toBeInTheDocument();
  });

  it("shows the column-loading state when a table is selected but columns are still in flight", () => {
    mountDistinct();
    render(<Harness selectedTableName="readings" isColumnsLoading />);
    expect(screen.getByText("workspace.inspector.loadingColumns")).toBeInTheDocument();
  });

  it("shows the column error state when columnsError is set", () => {
    mountDistinct();
    render(<Harness selectedTableName="readings" columnsError={new Error("boom")} />);
    expect(screen.getByText("workspace.inspector.failedToLoadColumns")).toBeInTheDocument();
  });

  it("shows the no-valid-columns notice when columns is empty after load", () => {
    mountDistinct();
    render(<Harness selectedTableName="readings" />);
    expect(screen.getByText("workspace.inspector.noValidColumns")).toBeInTheDocument();
  });

  it("shows the failed-to-load-tables note inside the dropdown when tablesError is set", async () => {
    mountDistinct();
    render(<Harness tablesError={new Error("nope")} tables={[]} />);
    // The error appears inside the select content; open the trigger.
    const trigger = screen.getByRole("combobox");
    trigger.click();
    await waitFor(() =>
      expect(screen.getByText("workspace.inspector.failedToLoadTables")).toBeInTheDocument(),
    );
  });
});
