import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { ExperimentTableWithColumns } from "@/hooks/experiment/useExperimentTables/useExperimentTables";

import type { ChartFormValues } from "../../chart-configurator-util";
import YAxisConfiguration from "./y-axis-configuration";

// Mock jsdom APIs needed by Radix UI components
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    observe() {}
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    unobserve() {}
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    disconnect() {}
  };

  HTMLElement.prototype.hasPointerCapture = () => false;
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  HTMLElement.prototype.scrollIntoView = () => {};
});

// Mock table data
const mockTable: ExperimentTableWithColumns = {
  name: "test-table",
  tableMetadata: {
    columns: [],
    totalRows: 0,
    totalPages: 0,
  },
  tableRows: [],
  columns: [
    { name: "time", type_name: "timestamp", type_text: "timestamp" },
    { name: "temperature", type_name: "double", type_text: "double" },
    { name: "humidity", type_name: "double", type_text: "double" },
    { name: "pressure", type_name: "integer", type_text: "integer" },
  ],
};

// Test wrapper component with form context
function TestWrapper({
  defaultValues,
  table = mockTable,
  yAxisDataSources = [],
  onAddSeries = vi.fn(),
  onRemoveSeries = vi.fn(),
  isColorColumnSelected = false,
}: {
  defaultValues?: Partial<ChartFormValues>;
  table?: ExperimentTableWithColumns;
  yAxisDataSources?: { field: { id: string; columnName: string; role: string }; index: number }[];
  onAddSeries?: () => void;
  onRemoveSeries?: (index: number) => void;
  isColorColumnSelected?: boolean;
}) {
  const methods = useForm<ChartFormValues>({
    defaultValues: {
      name: "",
      chartFamily: "basic",
      chartType: "line",
      config: {
        yAxisTitle: defaultValues?.config?.yAxisTitle ?? "",
        yAxisType: defaultValues?.config?.yAxisType ?? "linear",
        color: defaultValues?.config?.color ?? [],
      },
      dataConfig: {
        tableName: defaultValues?.dataConfig?.tableName ?? "test-table",
        dataSources: defaultValues?.dataConfig?.dataSources ?? [],
      },
    } as ChartFormValues,
  });

  return (
    <FormProvider {...methods}>
      <YAxisConfiguration
        form={methods}
        table={table}
        yAxisDataSources={yAxisDataSources}
        addYAxisSeries={onAddSeries}
        removeDataSource={onRemoveSeries}
        isColorColumnSelected={isColorColumnSelected}
      />
    </FormProvider>
  );
}

describe("YAxisConfiguration", () => {
  describe("Rendering", () => {
    it("should render Y-axis section header", () => {
      render(<TestWrapper />);

      expect(screen.getByText(/configuration\.columns\.yAxis/i)).toBeInTheDocument();
    });

    it("should render add series button", () => {
      render(<TestWrapper />);

      expect(screen.getByRole("button", { name: /add/i })).toBeInTheDocument();
      expect(screen.getByText(/configuration\.series\.add/i)).toBeInTheDocument();
    });

    it("should not render any series cards when yAxisDataSources is empty", () => {
      render(<TestWrapper yAxisDataSources={[]} />);

      expect(screen.queryByText(/configuration\.series\.title/i)).not.toBeInTheDocument();
    });

    it("should render series card for each data source", () => {
      const yAxisDataSources = [
        {
          field: { id: "y1", columnName: "temperature", role: "y" },
          index: 1,
        },
        {
          field: { id: "y2", columnName: "humidity", role: "y" },
          index: 2,
        },
      ];

      render(
        <TestWrapper
          yAxisDataSources={yAxisDataSources}
          defaultValues={{
            dataConfig: {
              tableName: "test-table",
              dataSources: [
                { tableName: "test-table", columnName: "time", role: "x", alias: "" },
                { tableName: "test-table", columnName: "temperature", role: "y", alias: "" },
                { tableName: "test-table", columnName: "humidity", role: "y", alias: "" },
              ],
            },
          }}
        />,
      );

      const temperatureElements = screen.getAllByText("temperature");
      expect(temperatureElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("humidity").length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Add Series Button", () => {
    it("should call addYAxisSeries when add button is clicked", async () => {
      const user = userEvent.setup();
      const onAddSeries = vi.fn();

      render(<TestWrapper onAddSeries={onAddSeries} />);

      await user.click(screen.getByRole("button", { name: /add/i }));

      expect(onAddSeries).toHaveBeenCalledTimes(1);
    });
  });

  describe("Series Cards", () => {
    it("should display series title with column name", () => {
      const yAxisDataSources = [
        {
          field: { id: "y1", columnName: "temperature", role: "y" },
          index: 1,
        },
      ];

      render(
        <TestWrapper
          yAxisDataSources={yAxisDataSources}
          defaultValues={{
            dataConfig: {
              tableName: "test-table",
              dataSources: [
                { tableName: "test-table", columnName: "time", role: "x", alias: "" },
                { tableName: "test-table", columnName: "temperature", role: "y", alias: "" },
              ],
            },
          }}
        />,
      );

      const temperatureElements = screen.getAllByText("temperature");
      expect(temperatureElements.length).toBeGreaterThanOrEqual(1);
    });

    it("should display generic series title when column name is empty", () => {
      const yAxisDataSources = [
        {
          field: { id: "y1", columnName: "", role: "y" },
          index: 1,
        },
      ];

      render(
        <TestWrapper
          yAxisDataSources={yAxisDataSources}
          defaultValues={{
            dataConfig: {
              tableName: "test-table",
              dataSources: [
                { tableName: "test-table", columnName: "time", role: "x", alias: "" },
                { tableName: "test-table", columnName: "", role: "y", alias: "" },
              ],
            },
          }}
        />,
      );

      expect(screen.getByText(/configuration\.series\.title 1/i)).toBeInTheDocument();
    });

    it("should show remove button for each series", () => {
      const yAxisDataSources = [
        {
          field: { id: "y1", columnName: "temperature", role: "y" },
          index: 1,
        },
        {
          field: { id: "y2", columnName: "humidity", role: "y" },
          index: 2,
        },
      ];

      render(
        <TestWrapper
          yAxisDataSources={yAxisDataSources}
          defaultValues={{
            dataConfig: {
              tableName: "test-table",
              dataSources: [
                { tableName: "test-table", columnName: "time", role: "x", alias: "" },
                { tableName: "test-table", columnName: "temperature", role: "y", alias: "" },
                { tableName: "test-table", columnName: "humidity", role: "y", alias: "" },
              ],
            },
          }}
        />,
      );

      const removeButtons = screen.getAllByRole("button", { name: "" });
      // Filter for buttons that have the Trash2 icon (remove buttons)
      const trashButtons = removeButtons.filter((btn) => btn.querySelector("svg"));
      expect(trashButtons.length).toBeGreaterThanOrEqual(2);
    });

    it("should disable remove button when only one series exists", () => {
      const yAxisDataSources = [
        {
          field: { id: "y1", columnName: "temperature", role: "y" },
          index: 1,
        },
      ];

      render(
        <TestWrapper
          yAxisDataSources={yAxisDataSources}
          defaultValues={{
            dataConfig: {
              tableName: "test-table",
              dataSources: [
                { tableName: "test-table", columnName: "time", role: "x", alias: "" },
                { tableName: "test-table", columnName: "temperature", role: "y", alias: "" },
              ],
            },
          }}
        />,
      );

      const removeButtons = screen.getAllByRole("button", { name: "" });
      const trashButton = removeButtons.find((btn) => btn.querySelector("svg"));
      expect(trashButton).toBeDisabled();
    });

    it("should call removeDataSource with correct index when remove button is clicked", async () => {
      const user = userEvent.setup();
      const onRemoveSeries = vi.fn();

      const yAxisDataSources = [
        {
          field: { id: "y1", columnName: "temperature", role: "y" },
          index: 1,
        },
        {
          field: { id: "y2", columnName: "humidity", role: "y" },
          index: 2,
        },
      ];

      render(
        <TestWrapper
          yAxisDataSources={yAxisDataSources}
          onRemoveSeries={onRemoveSeries}
          defaultValues={{
            dataConfig: {
              tableName: "test-table",
              dataSources: [
                { tableName: "test-table", columnName: "time", role: "x", alias: "" },
                { tableName: "test-table", columnName: "temperature", role: "y", alias: "" },
                { tableName: "test-table", columnName: "humidity", role: "y", alias: "" },
              ],
            },
          }}
        />,
      );

      const removeButtons = screen.getAllByRole("button", { name: "" });
      const trashButtons = removeButtons.filter(
        (btn) => btn.querySelector("svg") && !(btn as HTMLButtonElement).disabled,
      );

      if (trashButtons[0]) {
        await user.click(trashButtons[0]);
        expect(onRemoveSeries).toHaveBeenCalledWith(1);
      }
    });
  });

  describe("Column Select", () => {
    it("should render data column select for each series", () => {
      const yAxisDataSources = [
        {
          field: { id: "y1", columnName: "temperature", role: "y" },
          index: 1,
        },
      ];

      render(
        <TestWrapper
          yAxisDataSources={yAxisDataSources}
          defaultValues={{
            dataConfig: {
              tableName: "test-table",
              dataSources: [
                { tableName: "test-table", columnName: "time", role: "x", alias: "" },
                { tableName: "test-table", columnName: "temperature", role: "y", alias: "" },
              ],
            },
          }}
        />,
      );

      expect(screen.getByText(/configuration\.columns\.dataColumn/i)).toBeInTheDocument();
    });

    it("should show all available columns when column select is opened", async () => {
      const user = userEvent.setup();

      const yAxisDataSources = [
        {
          field: { id: "y1", columnName: "temperature", role: "y" },
          index: 1,
        },
      ];

      render(
        <TestWrapper
          yAxisDataSources={yAxisDataSources}
          defaultValues={{
            dataConfig: {
              tableName: "test-table",
              dataSources: [
                { tableName: "test-table", columnName: "time", role: "x", alias: "" },
                { tableName: "test-table", columnName: "temperature", role: "y", alias: "" },
              ],
            },
          }}
        />,
      );

      const selects = screen.getAllByRole("combobox");
      const columnSelect = selects[0];

      await user.click(columnSelect);

      expect(screen.getByText("time")).toBeInTheDocument();
      expect(screen.getAllByText("temperature").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("humidity").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("pressure").length).toBeGreaterThanOrEqual(1);
    });

    it("should display column type badges in dropdown", async () => {
      const user = userEvent.setup();

      const yAxisDataSources = [
        {
          field: { id: "y1", columnName: "temperature", role: "y" },
          index: 1,
        },
      ];

      render(
        <TestWrapper
          yAxisDataSources={yAxisDataSources}
          defaultValues={{
            dataConfig: {
              tableName: "test-table",
              dataSources: [
                { tableName: "test-table", columnName: "time", role: "x", alias: "" },
                { tableName: "test-table", columnName: "temperature", role: "y", alias: "" },
              ],
            },
          }}
        />,
      );

      const selects = screen.getAllByRole("combobox");
      const columnSelect = selects[0];

      await user.click(columnSelect);

      expect(screen.getByText("timestamp")).toBeInTheDocument();
      expect(screen.getAllByText("double").length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText("integer")).toBeInTheDocument();
    });

    it("should auto-fill Y-axis title when first series column is selected", async () => {
      const user = userEvent.setup();

      const yAxisDataSources = [
        {
          field: { id: "y1", columnName: "", role: "y" },
          index: 1,
        },
      ];

      render(
        <TestWrapper
          yAxisDataSources={yAxisDataSources}
          defaultValues={{
            dataConfig: {
              tableName: "test-table",
              dataSources: [
                { tableName: "test-table", columnName: "time", role: "x", alias: "" },
                { tableName: "test-table", columnName: "", role: "y", alias: "" },
              ],
            },
          }}
        />,
      );

      const selects = screen.getAllByRole("combobox");
      const columnSelect = selects[0];

      await user.click(columnSelect);

      const option = screen.getByRole("option", { name: /temperature/ });
      await user.click(option);

      // Check if Y-axis title input shows in the first series styling section
      const titleInputs = screen.getAllByPlaceholderText(/enterAxisTitle/i);
      expect(titleInputs[0]).toHaveValue("temperature");
    });

    it("should always update Y-axis title when first series column changes, even if title exists", async () => {
      const user = userEvent.setup();

      const yAxisDataSources = [
        {
          field: { id: "y1", columnName: "temperature", role: "y" },
          index: 1,
        },
      ];

      render(
        <TestWrapper
          yAxisDataSources={yAxisDataSources}
          defaultValues={{
            config: {
              yAxisTitle: "Existing Title",
            },
            dataConfig: {
              tableName: "test-table",
              dataSources: [
                { tableName: "test-table", columnName: "time", role: "x", alias: "" },
                { tableName: "test-table", columnName: "temperature", role: "y", alias: "" },
              ],
            },
          }}
        />,
      );

      const selects = screen.getAllByRole("combobox");
      const columnSelect = selects[0];

      await user.click(columnSelect);

      const option = screen.getByRole("option", { name: /humidity/ });
      await user.click(option);

      // Check if Y-axis title input shows in the first series styling section
      const titleInputs = screen.getAllByPlaceholderText(/enterAxisTitle/i);
      expect(titleInputs[0]).toHaveValue("humidity");
    });

    it("should not update Y-axis title when non-first series column is selected", async () => {
      const user = userEvent.setup();

      const yAxisDataSources = [
        {
          field: { id: "y1", columnName: "temperature", role: "y" },
          index: 1,
        },
        {
          field: { id: "y2", columnName: "humidity", role: "y" },
          index: 2,
        },
      ];

      render(
        <TestWrapper
          yAxisDataSources={yAxisDataSources}
          defaultValues={{
            config: {
              yAxisTitle: "Initial Title",
            },
            dataConfig: {
              tableName: "test-table",
              dataSources: [
                { tableName: "test-table", columnName: "time", role: "x", alias: "" },
                { tableName: "test-table", columnName: "temperature", role: "y", alias: "" },
                { tableName: "test-table", columnName: "humidity", role: "y", alias: "" },
              ],
            },
          }}
        />,
      );

      // Find the second series column select (should be index 2 in comboboxes)
      const selects = screen.getAllByRole("combobox");
      const secondSeriesColumnSelect = selects[2]; // First is first series column, second is first series type, third is second series column

      await user.click(secondSeriesColumnSelect);

      const option = screen.getByRole("option", { name: /pressure/ });
      await user.click(option);

      // Y-axis title should remain unchanged
      const titleInputs = screen.getAllByPlaceholderText(/enterAxisTitle/i);
      expect(titleInputs[0]).toHaveValue("Initial Title");
    });
  });

  describe("Series Name Input", () => {
    it("should render series name input for each series", () => {
      const yAxisDataSources = [
        {
          field: { id: "y1", columnName: "temperature", role: "y" },
          index: 1,
        },
      ];

      render(
        <TestWrapper
          yAxisDataSources={yAxisDataSources}
          defaultValues={{
            dataConfig: {
              tableName: "test-table",
              dataSources: [
                { tableName: "test-table", columnName: "time", role: "x", alias: "" },
                { tableName: "test-table", columnName: "temperature", role: "y", alias: "" },
              ],
            },
          }}
        />,
      );

      expect(screen.getByText(/configuration\.series\.name/i)).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(/configuration\.placeholders\.enterSeriesName/i),
      ).toBeInTheDocument();
    });

    it("should allow typing in series name input", async () => {
      const user = userEvent.setup();

      const yAxisDataSources = [
        {
          field: { id: "y1", columnName: "temperature", role: "y" },
          index: 1,
        },
      ];

      render(
        <TestWrapper
          yAxisDataSources={yAxisDataSources}
          defaultValues={{
            dataConfig: {
              tableName: "test-table",
              dataSources: [
                { tableName: "test-table", columnName: "time", role: "x", alias: "" },
                { tableName: "test-table", columnName: "temperature", role: "y", alias: "" },
              ],
            },
          }}
        />,
      );

      const input = screen.getByPlaceholderText(/enterSeriesName/i);
      await user.type(input, "Temperature Data");

      expect(input).toHaveValue("Temperature Data");
    });

    it("should display provided series name alias", () => {
      const yAxisDataSources = [
        {
          field: { id: "y1", columnName: "temperature", role: "y" },
          index: 1,
        },
      ];

      render(
        <TestWrapper
          yAxisDataSources={yAxisDataSources}
          defaultValues={{
            dataConfig: {
              tableName: "test-table",
              dataSources: [
                { tableName: "test-table", columnName: "time", role: "x", alias: "" },
                {
                  tableName: "test-table",
                  columnName: "temperature",
                  role: "y",
                  alias: "Temp (°C)",
                },
              ],
            },
          }}
        />,
      );

      const input = screen.getByPlaceholderText(/enterSeriesName/i);
      expect(input).toHaveValue("Temp (°C)");
    });
  });

  describe("Color Picker", () => {
    it("should render color picker for each series", () => {
      const yAxisDataSources = [
        {
          field: { id: "y1", columnName: "temperature", role: "y" },
          index: 1,
        },
      ];

      render(
        <TestWrapper
          yAxisDataSources={yAxisDataSources}
          defaultValues={{
            dataConfig: {
              tableName: "test-table",
              dataSources: [
                { tableName: "test-table", columnName: "time", role: "x", alias: "" },
                { tableName: "test-table", columnName: "temperature", role: "y", alias: "" },
              ],
            },
            config: {
              color: ["#ff0000"],
            },
          }}
        />,
      );

      expect(screen.getByText(/configuration\.series\.color/i)).toBeInTheDocument();
      const colorInputs = screen.getAllByDisplayValue("#ff0000");
      expect(colorInputs.length).toBeGreaterThanOrEqual(1);
    });

    it("should disable color picker when isColorColumnSelected is true", () => {
      const yAxisDataSources = [
        {
          field: { id: "y1", columnName: "temperature", role: "y" },
          index: 1,
        },
      ];

      render(
        <TestWrapper
          yAxisDataSources={yAxisDataSources}
          isColorColumnSelected={true}
          defaultValues={{
            dataConfig: {
              tableName: "test-table",
              dataSources: [
                { tableName: "test-table", columnName: "time", role: "x", alias: "" },
                { tableName: "test-table", columnName: "temperature", role: "y", alias: "" },
              ],
            },
            config: {
              color: ["#ff0000"],
            },
          }}
        />,
      );

      const colorInputs = screen.getAllByDisplayValue("#ff0000");
      colorInputs.forEach((input) => {
        expect(input).toBeDisabled();
      });
    });

    it("should enable color picker when isColorColumnSelected is false", () => {
      const yAxisDataSources = [
        {
          field: { id: "y1", columnName: "temperature", role: "y" },
          index: 1,
        },
      ];

      render(
        <TestWrapper
          yAxisDataSources={yAxisDataSources}
          isColorColumnSelected={false}
          defaultValues={{
            dataConfig: {
              tableName: "test-table",
              dataSources: [
                { tableName: "test-table", columnName: "time", role: "x", alias: "" },
                { tableName: "test-table", columnName: "temperature", role: "y", alias: "" },
              ],
            },
            config: {
              color: ["#ff0000"],
            },
          }}
        />,
      );

      const colorInputs = screen.getAllByDisplayValue("#ff0000");
      colorInputs.forEach((input) => {
        expect(input).not.toBeDisabled();
      });
    });
  });

  describe("Axis Type Select", () => {
    it("should render axis type select", () => {
      const yAxisDataSources = [
        {
          field: { id: "y1", columnName: "temperature", role: "y" },
          index: 1,
        },
      ];

      render(
        <TestWrapper
          yAxisDataSources={yAxisDataSources}
          defaultValues={{
            dataConfig: {
              tableName: "test-table",
              dataSources: [
                { tableName: "test-table", columnName: "time", role: "x", alias: "" },
                { tableName: "test-table", columnName: "temperature", role: "y", alias: "" },
              ],
            },
          }}
        />,
      );

      const typeLabels = screen.getAllByText(/configuration\.axes\.type/i);
      expect(typeLabels.length).toBeGreaterThanOrEqual(1);
    });

    it("should display default linear axis type", () => {
      const yAxisDataSources = [
        {
          field: { id: "y1", columnName: "temperature", role: "y" },
          index: 1,
        },
      ];

      render(
        <TestWrapper
          yAxisDataSources={yAxisDataSources}
          defaultValues={{
            dataConfig: {
              tableName: "test-table",
              dataSources: [
                { tableName: "test-table", columnName: "time", role: "x", alias: "" },
                { tableName: "test-table", columnName: "temperature", role: "y", alias: "" },
              ],
            },
          }}
        />,
      );

      expect(screen.getByText(/configuration\.axisTypes\.linear/i)).toBeInTheDocument();
    });

    it("should show all axis type options when opened", async () => {
      const user = userEvent.setup();

      const yAxisDataSources = [
        {
          field: { id: "y1", columnName: "temperature", role: "y" },
          index: 1,
        },
      ];

      render(
        <TestWrapper
          yAxisDataSources={yAxisDataSources}
          defaultValues={{
            dataConfig: {
              tableName: "test-table",
              dataSources: [
                { tableName: "test-table", columnName: "time", role: "x", alias: "" },
                { tableName: "test-table", columnName: "temperature", role: "y", alias: "" },
              ],
            },
          }}
        />,
      );

      const selects = screen.getAllByRole("combobox");
      const typeSelect = selects.find((select) => select.textContent?.includes("linear"));

      if (typeSelect) {
        await user.click(typeSelect);

        const linearOptions = screen.getAllByText(/configuration\.axisTypes\.linear/i);
        expect(linearOptions.length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/configuration\.axisTypes\.log/i)).toBeInTheDocument();
        expect(screen.getByText(/configuration\.axisTypes\.date/i)).toBeInTheDocument();
      }
    });
  });

  describe("Axis Title Input", () => {
    it("should render axis title input only for first series", () => {
      const yAxisDataSources = [
        {
          field: { id: "y1", columnName: "temperature", role: "y" },
          index: 1,
        },
        {
          field: { id: "y2", columnName: "humidity", role: "y" },
          index: 2,
        },
      ];

      render(
        <TestWrapper
          yAxisDataSources={yAxisDataSources}
          defaultValues={{
            dataConfig: {
              tableName: "test-table",
              dataSources: [
                { tableName: "test-table", columnName: "time", role: "x", alias: "" },
                { tableName: "test-table", columnName: "temperature", role: "y", alias: "" },
                { tableName: "test-table", columnName: "humidity", role: "y", alias: "" },
              ],
            },
          }}
        />,
      );

      const axisTitleInputs = screen.getAllByPlaceholderText(/enterAxisTitle/i);
      // Should only have one axis title input (for first series)
      expect(axisTitleInputs.length).toBe(1);
    });

    it("should allow typing in axis title input", async () => {
      const user = userEvent.setup();

      const yAxisDataSources = [
        {
          field: { id: "y1", columnName: "temperature", role: "y" },
          index: 1,
        },
      ];

      render(
        <TestWrapper
          yAxisDataSources={yAxisDataSources}
          defaultValues={{
            dataConfig: {
              tableName: "test-table",
              dataSources: [
                { tableName: "test-table", columnName: "time", role: "x", alias: "" },
                { tableName: "test-table", columnName: "temperature", role: "y", alias: "" },
              ],
            },
          }}
        />,
      );

      const input = screen.getByPlaceholderText(/enterAxisTitle/i);
      await user.type(input, "Y-Axis Label");

      expect(input).toHaveValue("Y-Axis Label");
    });

    it("should display provided axis title", () => {
      const yAxisDataSources = [
        {
          field: { id: "y1", columnName: "temperature", role: "y" },
          index: 1,
        },
      ];

      render(
        <TestWrapper
          yAxisDataSources={yAxisDataSources}
          defaultValues={{
            config: {
              yAxisTitle: "Temperature (°C)",
            },
            dataConfig: {
              tableName: "test-table",
              dataSources: [
                { tableName: "test-table", columnName: "time", role: "x", alias: "" },
                { tableName: "test-table", columnName: "temperature", role: "y", alias: "" },
              ],
            },
          }}
        />,
      );

      const input = screen.getByPlaceholderText(/enterAxisTitle/i);
      expect(input).toHaveValue("Temperature (°C)");
    });
  });

  describe("Multiple Series", () => {
    it("should render multiple series cards", () => {
      const yAxisDataSources = [
        {
          field: { id: "y1", columnName: "temperature", role: "y" },
          index: 1,
        },
        {
          field: { id: "y2", columnName: "humidity", role: "y" },
          index: 2,
        },
        {
          field: { id: "y3", columnName: "pressure", role: "y" },
          index: 3,
        },
      ];

      render(
        <TestWrapper
          yAxisDataSources={yAxisDataSources}
          defaultValues={{
            dataConfig: {
              tableName: "test-table",
              dataSources: [
                { tableName: "test-table", columnName: "time", role: "x", alias: "" },
                { tableName: "test-table", columnName: "temperature", role: "y", alias: "" },
                { tableName: "test-table", columnName: "humidity", role: "y", alias: "" },
                { tableName: "test-table", columnName: "pressure", role: "y", alias: "" },
              ],
            },
          }}
        />,
      );

      const temperatureElements = screen.getAllByText("temperature");
      expect(temperatureElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("humidity").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("pressure").length).toBeGreaterThanOrEqual(1);
    });

    it("should number series titles correctly", () => {
      const yAxisDataSources = [
        {
          field: { id: "y1", columnName: "", role: "y" },
          index: 1,
        },
        {
          field: { id: "y2", columnName: "", role: "y" },
          index: 2,
        },
        {
          field: { id: "y3", columnName: "", role: "y" },
          index: 3,
        },
      ];

      render(
        <TestWrapper
          yAxisDataSources={yAxisDataSources}
          defaultValues={{
            dataConfig: {
              tableName: "test-table",
              dataSources: [
                { tableName: "test-table", columnName: "time", role: "x", alias: "" },
                { tableName: "test-table", columnName: "", role: "y", alias: "" },
                { tableName: "test-table", columnName: "", role: "y", alias: "" },
                { tableName: "test-table", columnName: "", role: "y", alias: "" },
              ],
            },
          }}
        />,
      );

      expect(screen.getByText(/configuration\.series\.title 1/i)).toBeInTheDocument();
      expect(screen.getByText(/configuration\.series\.title 2/i)).toBeInTheDocument();
      expect(screen.getByText(/configuration\.series\.title 3/i)).toBeInTheDocument();
    });
  });
});
