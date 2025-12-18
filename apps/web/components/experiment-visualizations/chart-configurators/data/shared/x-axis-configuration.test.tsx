import type { ExperimentTableWithColumns } from "@/hooks/experiment/useExperimentTables/useExperimentTables";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { beforeAll, describe, expect, it } from "vitest";

import type { ChartFormValues } from "../../chart-configurator-util";
import XAxisConfiguration from "./x-axis-configuration";

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
  xAxisDataSources,
}: {
  defaultValues?: Partial<ChartFormValues>;
  table?: ExperimentTableWithColumns;
  xAxisDataSources?: { field: { columnName: string; role: string }; index: number }[];
}) {
  const methods = useForm<ChartFormValues>({
    defaultValues: {
      name: "",
      chartFamily: "basic",
      chartType: "line",
      config: {
        xAxisTitle: defaultValues?.config?.xAxisTitle ?? "",
        xAxisType: defaultValues?.config?.xAxisType ?? "linear",
      },
      dataConfig: {
        tableName: defaultValues?.dataConfig?.tableName ?? "test-table",
        dataSources: defaultValues?.dataConfig?.dataSources ?? [
          { tableName: "test-table", columnName: "", role: "x-axis", alias: "" },
        ],
      },
    } as ChartFormValues,
  });

  return (
    <FormProvider {...methods}>
      <XAxisConfiguration form={methods} table={table} xAxisDataSources={xAxisDataSources} />
    </FormProvider>
  );
}

describe("XAxisConfiguration", () => {
  describe("Rendering", () => {
    it("should render X-axis column select field", () => {
      render(<TestWrapper />);

      expect(screen.getByText(/configuration\.columns\.xAxis/i)).toBeInTheDocument();
      expect(screen.getByText(/configuration\.columns\.select/i)).toBeInTheDocument();
    });

    it("should render axis title input field", () => {
      render(<TestWrapper />);

      expect(screen.getByText(/configuration\.axes\.title/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/enterAxisTitle/i)).toBeInTheDocument();
    });

    it("should render axis type select field", () => {
      render(<TestWrapper />);

      const typeLabels = screen.getAllByText(/configuration\.axes\.type/i);
      expect(typeLabels.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Column Select", () => {
    it("should display placeholder when no column is selected", () => {
      render(<TestWrapper />);

      expect(screen.getByText(/configuration\.columns\.select/i)).toBeInTheDocument();
    });

    it("should display selected column value", () => {
      render(
        <TestWrapper
          defaultValues={{
            dataConfig: {
              tableName: "test-table",
              dataSources: [
                { tableName: "test-table", columnName: "time", role: "x-axis", alias: "" },
              ],
            },
          }}
        />,
      );

      expect(screen.getByText("time")).toBeInTheDocument();
    });

    it("should show all available columns when opened", async () => {
      const user = userEvent.setup();
      render(<TestWrapper />);

      const trigger = screen.getByRole("combobox", { name: /xAxis/i });
      await user.click(trigger);

      expect(screen.getByText("time")).toBeInTheDocument();
      expect(screen.getByText("temperature")).toBeInTheDocument();
      expect(screen.getByText("humidity")).toBeInTheDocument();
      expect(screen.getByText("pressure")).toBeInTheDocument();
    });

    it("should display column type badges", async () => {
      const user = userEvent.setup();
      render(<TestWrapper />);

      const trigger = screen.getByRole("combobox", { name: /xAxis/i });
      await user.click(trigger);

      expect(screen.getByText("timestamp")).toBeInTheDocument();
      expect(screen.getAllByText("double").length).toBe(2);
      expect(screen.getByText("integer")).toBeInTheDocument();
    });

    it("should allow selecting a column", async () => {
      const user = userEvent.setup();
      render(<TestWrapper />);

      const trigger = screen.getByRole("combobox", { name: /xAxis/i });
      await user.click(trigger);

      const option = screen.getByRole("option", { name: /time/ });
      await user.click(option);

      expect(screen.getByText("time")).toBeInTheDocument();
    });

    it("should auto-fill axis title when column is selected", async () => {
      const user = userEvent.setup();
      render(<TestWrapper />);

      const trigger = screen.getByRole("combobox", { name: /xAxis/i });
      await user.click(trigger);

      const option = screen.getByRole("option", { name: /temperature/ });
      await user.click(option);

      const titleInput = screen.getByPlaceholderText(/enterAxisTitle/i);
      expect(titleInput).toHaveValue("temperature");
    });

    it("should always update axis title when column changes, even if title exists", async () => {
      const user = userEvent.setup();
      render(<TestWrapper defaultValues={{ config: { xAxisTitle: "Existing Title" } }} />);

      const trigger = screen.getByRole("combobox", { name: /xAxis/i });
      await user.click(trigger);

      const option = screen.getByRole("option", { name: /humidity/ });
      await user.click(option);

      const titleInput = screen.getByPlaceholderText(/enterAxisTitle/i);
      expect(titleInput).toHaveValue("humidity");
    });
  });

  describe("Axis Title Input", () => {
    it("should display default empty title", () => {
      render(<TestWrapper />);

      const input = screen.getByPlaceholderText(/enterAxisTitle/i);
      expect(input).toHaveValue("");
    });

    it("should display provided title value", () => {
      render(<TestWrapper defaultValues={{ config: { xAxisTitle: "Time (seconds)" } }} />);

      const input = screen.getByPlaceholderText(/enterAxisTitle/i);
      expect(input).toHaveValue("Time (seconds)");
    });

    it("should allow typing in title input", async () => {
      const user = userEvent.setup();
      render(<TestWrapper />);

      const input = screen.getByPlaceholderText(/enterAxisTitle/i);
      await user.type(input, "Custom Title");

      expect(input).toHaveValue("Custom Title");
    });

    it("should allow clearing title input", async () => {
      const user = userEvent.setup();
      render(<TestWrapper defaultValues={{ config: { xAxisTitle: "Initial Title" } }} />);

      const input = screen.getByPlaceholderText(/enterAxisTitle/i);
      await user.clear(input);

      expect(input).toHaveValue("");
    });
  });

  describe("Axis Type Select", () => {
    it("should display default linear type", () => {
      render(<TestWrapper />);

      expect(screen.getByText(/configuration\.axisTypes\.linear/i)).toBeInTheDocument();
    });

    it("should display selected axis type", () => {
      render(<TestWrapper defaultValues={{ config: { xAxisType: "log" } }} />);

      expect(screen.getByText(/configuration\.axisTypes\.log/i)).toBeInTheDocument();
    });

    it("should show all axis type options when opened", async () => {
      const user = userEvent.setup();
      render(<TestWrapper />);

      const triggers = screen.getAllByRole("combobox");
      const typeSelect = triggers.find((trigger) => {
        const text = trigger.textContent;
        return (
          (text?.includes("linear") ?? false) ||
          (text?.includes("log") ?? false) ||
          (text?.includes("date") ?? false)
        );
      });

      if (typeSelect) {
        await user.click(typeSelect);

        // Check that all three options are present in the dropdown
        const linearOptions = screen.getAllByText(/configuration\.axisTypes\.linear/i);
        expect(linearOptions.length).toBeGreaterThanOrEqual(1);

        expect(screen.getByText(/configuration\.axisTypes\.log/i)).toBeInTheDocument();
        expect(screen.getByText(/configuration\.axisTypes\.date/i)).toBeInTheDocument();
      }
    });

    it("should allow changing axis type to log", async () => {
      const user = userEvent.setup();
      render(<TestWrapper />);

      const triggers = screen.getAllByRole("combobox");
      const typeSelect = triggers.find((trigger) => trigger.textContent?.includes("linear"));

      if (typeSelect) {
        await user.click(typeSelect);

        const logOption = screen.getByRole("option", { name: /log/i });
        await user.click(logOption);

        expect(screen.getByText(/configuration\.axisTypes\.log/i)).toBeInTheDocument();
      }
    });

    it("should allow changing axis type to date", async () => {
      const user = userEvent.setup();
      render(<TestWrapper />);

      const triggers = screen.getAllByRole("combobox");
      const typeSelect = triggers.find((trigger) => trigger.textContent?.includes("linear"));

      if (typeSelect) {
        await user.click(typeSelect);

        const dateOption = screen.getByRole("option", { name: /date/i });
        await user.click(dateOption);

        expect(screen.getByText(/configuration\.axisTypes\.date/i)).toBeInTheDocument();
      }
    });
  });

  describe("Layout", () => {
    it("should render fields in a grid layout", () => {
      const { container } = render(<TestWrapper />);

      const grid = container.querySelector(".grid");
      expect(grid).toBeInTheDocument();
    });

    it("should have all three fields visible", () => {
      render(<TestWrapper />);

      // Column select
      expect(screen.getByRole("combobox", { name: /xAxis/i })).toBeInTheDocument();

      // Title input
      expect(screen.getByPlaceholderText(/enterAxisTitle/i)).toBeInTheDocument();

      // Type select
      const triggers = screen.getAllByRole("combobox");
      expect(triggers.length).toBeGreaterThanOrEqual(2);
    });
  });
});
