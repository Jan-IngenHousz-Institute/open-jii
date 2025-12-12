import type { ExperimentTableWithColumns } from "@/hooks/experiment/useExperimentTables/useExperimentTables";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import type { ChartFormValues } from "../../../chart-configurator-util";
import ScatterChartDataConfigurator from "./scatter-chart-data-configurator";

// Mock the shared configuration components
vi.mock("../../shared/x-axis-configuration", () => ({
  default: ({
    xAxisDataSources,
  }: {
    xAxisDataSources: { field: { columnName: string }; index: number }[];
  }) => (
    <div data-testid="x-axis-config">
      X-Axis Config
      {xAxisDataSources.map((ds, idx) => (
        <div key={idx} data-testid={`x-axis-source-${idx}`}>
          {ds.field.columnName || "empty"}
        </div>
      ))}
    </div>
  ),
}));

vi.mock("../../shared/y-axis-configuration", () => ({
  default: ({
    yAxisDataSources,
    addYAxisSeries,
    isColorColumnSelected,
  }: {
    yAxisDataSources: { field: { columnName: string }; index: number }[];
    addYAxisSeries: () => void;
    isColorColumnSelected: boolean;
  }) => (
    <div data-testid="y-axis-config">
      Y-Axis Config
      <button onClick={addYAxisSeries} data-testid="add-y-axis">
        Add Y Series
      </button>
      <div data-testid="color-selected">{isColorColumnSelected ? "yes" : "no"}</div>
      {yAxisDataSources.map((ds, idx) => (
        <div key={idx} data-testid={`y-axis-source-${idx}`}>
          {ds.field.columnName || "empty"}
        </div>
      ))}
    </div>
  ),
}));

vi.mock("../../shared/color-dimension-configuration", () => ({
  default: ({
    colorAxisDataSources,
  }: {
    colorAxisDataSources: { field: { columnName: string }; index: number }[];
  }) => (
    <div data-testid="color-config">
      Color Config
      {colorAxisDataSources.map((ds, idx) => (
        <div key={idx} data-testid={`color-axis-source-${idx}`}>
          {ds.field.columnName || "empty"}
        </div>
      ))}
    </div>
  ),
}));

// Test wrapper component
function TestWrapper({ initialValues }: { initialValues: Partial<ChartFormValues> }) {
  const form = useForm<ChartFormValues>({
    defaultValues: {
      ...initialValues,
    } as ChartFormValues,
  });

  const mockTable: ExperimentTableWithColumns = {
    name: "test_table",
    tableMetadata: {
      columns: [],
      totalRows: 0,
      totalPages: 0,
    },
    tableRows: [],
    columns: [
      { name: "timestamp", type_name: "timestamp", type_text: "timestamp" },
      { name: "temperature", type_name: "float", type_text: "float" },
      { name: "humidity", type_name: "float", type_text: "float" },
      { name: "sensor_id", type_name: "string", type_text: "string" },
    ],
  };

  return <ScatterChartDataConfigurator form={form} table={mockTable} />;
}

describe("ScatterChartDataConfigurator", () => {
  describe("Component Rendering", () => {
    it("should render all three configuration sections", () => {
      render(
        <TestWrapper
          initialValues={{
            dataConfig: {
              tableName: "test_table",
              dataSources: [],
            },
          }}
        />,
      );

      expect(screen.getByTestId("x-axis-config")).toBeInTheDocument();
      expect(screen.getByTestId("y-axis-config")).toBeInTheDocument();
      expect(screen.getByTestId("color-config")).toBeInTheDocument();
    });

    it("should render with proper spacing between sections", () => {
      const { container } = render(
        <TestWrapper
          initialValues={{
            dataConfig: {
              tableName: "test_table",
              dataSources: [],
            },
          }}
        />,
      );

      const mainDiv = container.firstChild as HTMLElement;
      expect(mainDiv).toHaveClass("space-y-6");
    });
  });

  describe("Data Source Filtering by Role", () => {
    it("should correctly filter x-axis data sources", () => {
      render(
        <TestWrapper
          initialValues={{
            dataConfig: {
              tableName: "test_table",
              dataSources: [
                { tableName: "test_table", columnName: "timestamp", role: "x", alias: "" },
                { tableName: "test_table", columnName: "temperature", role: "y", alias: "" },
              ],
            },
          }}
        />,
      );

      expect(screen.getByTestId("x-axis-source-0")).toHaveTextContent("timestamp");
      expect(screen.queryByTestId("x-axis-source-1")).not.toBeInTheDocument();
    });

    it("should correctly filter y-axis data sources", () => {
      render(
        <TestWrapper
          initialValues={{
            dataConfig: {
              tableName: "test_table",
              dataSources: [
                { tableName: "test_table", columnName: "timestamp", role: "x", alias: "" },
                { tableName: "test_table", columnName: "temperature", role: "y", alias: "Temp" },
                { tableName: "test_table", columnName: "humidity", role: "y", alias: "Humidity" },
              ],
            },
          }}
        />,
      );

      expect(screen.getByTestId("y-axis-source-0")).toHaveTextContent("temperature");
      expect(screen.getByTestId("y-axis-source-1")).toHaveTextContent("humidity");
    });

    it("should correctly filter color-axis data sources", () => {
      render(
        <TestWrapper
          initialValues={{
            dataConfig: {
              tableName: "test_table",
              dataSources: [
                { tableName: "test_table", columnName: "timestamp", role: "x", alias: "" },
                { tableName: "test_table", columnName: "temperature", role: "y", alias: "" },
                { tableName: "test_table", columnName: "sensor_id", role: "color", alias: "" },
              ],
            },
          }}
        />,
      );

      expect(screen.getByTestId("color-axis-source-0")).toHaveTextContent("sensor_id");
    });

    it("should handle multiple data sources of same role", () => {
      render(
        <TestWrapper
          initialValues={{
            dataConfig: {
              tableName: "test_table",
              dataSources: [
                { tableName: "test_table", columnName: "timestamp", role: "x", alias: "" },
                { tableName: "test_table", columnName: "temperature", role: "y", alias: "" },
                { tableName: "test_table", columnName: "humidity", role: "y", alias: "" },
                { tableName: "test_table", columnName: "pressure", role: "y", alias: "" },
              ],
            },
          }}
        />,
      );

      // Should have 3 y-axis sources
      expect(screen.getByTestId("y-axis-source-0")).toBeInTheDocument();
      expect(screen.getByTestId("y-axis-source-1")).toBeInTheDocument();
      expect(screen.getByTestId("y-axis-source-2")).toBeInTheDocument();
    });
  });

  describe("Color Column Selection Detection", () => {
    it("should detect when color column is selected", () => {
      render(
        <TestWrapper
          initialValues={{
            dataConfig: {
              tableName: "test_table",
              dataSources: [
                { tableName: "test_table", columnName: "timestamp", role: "x", alias: "" },
                { tableName: "test_table", columnName: "temperature", role: "y", alias: "" },
                { tableName: "test_table", columnName: "sensor_id", role: "color", alias: "" },
              ],
            },
          }}
        />,
      );

      expect(screen.getByTestId("color-selected")).toHaveTextContent("yes");
    });

    it("should detect when color column is not selected (no color data source)", () => {
      render(
        <TestWrapper
          initialValues={{
            dataConfig: {
              tableName: "test_table",
              dataSources: [
                { tableName: "test_table", columnName: "timestamp", role: "x", alias: "" },
                { tableName: "test_table", columnName: "temperature", role: "y", alias: "" },
              ],
            },
          }}
        />,
      );

      expect(screen.getByTestId("color-selected")).toHaveTextContent("no");
    });

    it("should detect when color data source exists but columnName is empty", () => {
      render(
        <TestWrapper
          initialValues={{
            dataConfig: {
              tableName: "test_table",
              dataSources: [
                { tableName: "test_table", columnName: "timestamp", role: "x", alias: "" },
                { tableName: "test_table", columnName: "temperature", role: "y", alias: "" },
                { tableName: "test_table", columnName: "", role: "color", alias: "" },
              ],
            },
          }}
        />,
      );

      expect(screen.getByTestId("color-selected")).toHaveTextContent("no");
    });
  });

  describe("Add Y-Axis Series Functionality", () => {
    it("should add new y-axis series with correct default values", async () => {
      const user = userEvent.setup();

      function TestWrapperWithState() {
        const form = useForm<ChartFormValues>({
          defaultValues: {
            dataConfig: {
              tableName: "test_table",
              dataSources: [
                { tableName: "test_table", columnName: "timestamp", role: "x", alias: "" },
                { tableName: "test_table", columnName: "temperature", role: "y", alias: "" },
              ],
            },
          } as ChartFormValues,
        });

        const mockTable: ExperimentTableWithColumns = {
          name: "test_table",
          tableMetadata: {
            columns: [],
            totalRows: 0,
            totalPages: 0,
          },
          tableRows: [],
          columns: [
            { name: "timestamp", type_name: "timestamp", type_text: "timestamp" },
            { name: "temperature", type_name: "float", type_text: "float" },
            { name: "humidity", type_name: "float", type_text: "float" },
          ],
        };

        return (
          <>
            <ScatterChartDataConfigurator form={form} table={mockTable} />
            <div data-testid="data-sources-count">
              {form.watch("dataConfig.dataSources").length}
            </div>
            <div data-testid="last-data-source-role">
              {form.watch("dataConfig.dataSources").at(-1)?.role ?? "none"}
            </div>
            <div data-testid="last-data-source-column">
              {form.watch("dataConfig.dataSources").at(-1)?.columnName
                ? form.watch("dataConfig.dataSources").at(-1)?.columnName
                : "empty"}
            </div>
          </>
        );
      }

      render(<TestWrapperWithState />);

      expect(screen.getByTestId("data-sources-count")).toHaveTextContent("2");

      await user.click(screen.getByTestId("add-y-axis"));

      expect(screen.getByTestId("data-sources-count")).toHaveTextContent("3");
      expect(screen.getByTestId("last-data-source-role")).toHaveTextContent("y");
      expect(screen.getByTestId("last-data-source-column")).toHaveTextContent("empty");
    });

    it("should use current tableName when adding new series", async () => {
      const user = userEvent.setup();

      function TestWrapperWithState() {
        const form = useForm<ChartFormValues>({
          defaultValues: {
            dataConfig: {
              tableName: "experiment_data",
              dataSources: [
                { tableName: "experiment_data", columnName: "timestamp", role: "x", alias: "" },
              ],
            },
          } as ChartFormValues,
        });

        const mockTable: ExperimentTableWithColumns = {
          name: "experiment_data",
          tableMetadata: {
            columns: [],
            totalRows: 0,
            totalPages: 0,
          },
          tableRows: [],
          columns: [{ name: "timestamp", type_name: "timestamp", type_text: "timestamp" }],
        };

        return (
          <>
            <ScatterChartDataConfigurator form={form} table={mockTable} />
            <div data-testid="last-data-source-table">
              {form.watch("dataConfig.dataSources").at(-1)?.tableName ?? "none"}
            </div>
          </>
        );
      }

      render(<TestWrapperWithState />);

      await user.click(screen.getByTestId("add-y-axis"));

      expect(screen.getByTestId("last-data-source-table")).toHaveTextContent("experiment_data");
    });
  });

  describe("Empty State Handling", () => {
    it("should handle empty data sources array", () => {
      render(
        <TestWrapper
          initialValues={{
            dataConfig: {
              tableName: "test_table",
              dataSources: [],
            },
          }}
        />,
      );

      // All sections should still render
      expect(screen.getByTestId("x-axis-config")).toBeInTheDocument();
      expect(screen.getByTestId("y-axis-config")).toBeInTheDocument();
      expect(screen.getByTestId("color-config")).toBeInTheDocument();

      // Should show no color selected
      expect(screen.getByTestId("color-selected")).toHaveTextContent("no");
    });

    it("should display empty state text in child components", () => {
      render(
        <TestWrapper
          initialValues={{
            dataConfig: {
              tableName: "test_table",
              dataSources: [
                { tableName: "test_table", columnName: "", role: "x", alias: "" },
                { tableName: "test_table", columnName: "", role: "y", alias: "" },
              ],
            },
          }}
        />,
      );

      expect(screen.getByTestId("x-axis-source-0")).toHaveTextContent("empty");
      expect(screen.getByTestId("y-axis-source-0")).toHaveTextContent("empty");
    });
  });
});
