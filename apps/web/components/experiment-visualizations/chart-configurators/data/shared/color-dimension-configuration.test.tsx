import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { SampleTable } from "~/hooks/experiment/useExperimentData/useExperimentData";

import type { ChartFormValues } from "../../chart-configurator-util";
import ColorDimensionConfiguration from "./color-dimension-configuration";

// Mock the translation hook
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Setup required jsdom APIs
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {
      // empty
    }
    unobserve() {
      // empty
    }
    disconnect() {
      // empty
    }
  };

  HTMLElement.prototype.hasPointerCapture = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

// Sample table data
const mockTable: SampleTable = {
  name: "test-table",
  tableMetadata: {
    columns: [],
    totalRows: 0,
    totalPages: 0,
  },
  tableRows: [],
  columns: [
    { name: "temperature", type_name: "DOUBLE", type_text: "double" },
    { name: "humidity", type_name: "DOUBLE", type_text: "double" },
    { name: "pressure", type_name: "DOUBLE", type_text: "double" },
    { name: "location", type_name: "VARCHAR", type_text: "varchar" },
  ],
  totalRows: 0,
};

// Test wrapper component
function TestWrapper({
  defaultValues,
  table = mockTable,
  colorAxisDataSources = [],
  onAppendDataSource = vi.fn(),
  onRemoveDataSource = vi.fn(),
}: {
  defaultValues?: Partial<ChartFormValues>;
  table?: SampleTable;
  colorAxisDataSources?: { field: { columnName: string; role: string }; index: number }[];
  onAppendDataSource?: (dataSource: {
    tableName: string;
    columnName: string;
    role: string;
    alias: string;
  }) => void;
  onRemoveDataSource?: (index: number) => void;
}) {
  const methods = useForm<ChartFormValues>({
    defaultValues: {
      name: "",
      chartFamily: "basic",
      chartType: "scatter",
      dataConfig: { tableName: "test-table" },
      config: {
        title: "",
        showlegend: true,
        gridlines: { x: true, y: true },
        xaxis: { title: { text: "" }, type: "linear" },
        yaxis: { title: { text: "" }, type: "linear" },
        colorAxisTitle: defaultValues?.config?.colorAxisTitle ?? "",
        marker: {
          colorscale: (defaultValues?.config?.marker?.colorscale as string) || "Viridis",
          showscale: defaultValues?.config?.marker?.showscale ?? true,
          colorbar: {
            title: {
              side: defaultValues?.config?.marker?.colorbar?.title?.side ?? "right",
            },
          },
        },
      },
      ...defaultValues,
    } as ChartFormValues,
  });

  return (
    <FormProvider {...methods}>
      <ColorDimensionConfiguration
        form={methods}
        table={table}
        colorAxisDataSources={colorAxisDataSources}
        appendDataSource={onAppendDataSource}
        removeDataSource={onRemoveDataSource}
      />
    </FormProvider>
  );
}

describe("ColorDimensionConfiguration", () => {
  describe("Rendering", () => {
    it("should render section header", () => {
      render(<TestWrapper />);

      expect(screen.getByText("configuration.color.dimensionConfig")).toBeInTheDocument();
    });

    it("should render color column select", () => {
      render(<TestWrapper />);

      expect(screen.getByText("configuration.columns.color")).toBeInTheDocument();
    });

    it("should not show colorbar checkbox when no color column selected", () => {
      render(<TestWrapper />);

      expect(screen.queryByText("configuration.chart.showColorbar")).not.toBeInTheDocument();
    });

    it("should not show color configuration when no color column selected", () => {
      render(<TestWrapper />);

      expect(screen.queryByText("configuration.color.scale")).not.toBeInTheDocument();
      expect(screen.queryByText("configuration.axes.titlePosition")).not.toBeInTheDocument();
    });

    it("should show colorbar checkbox when color column is selected", () => {
      render(
        <TestWrapper
          colorAxisDataSources={[{ field: { columnName: "temperature", role: "color" }, index: 0 }]}
        />,
      );

      expect(screen.getByText("configuration.chart.showColorbar")).toBeInTheDocument();
    });

    it("should show color configuration when color column is selected", () => {
      render(
        <TestWrapper
          colorAxisDataSources={[{ field: { columnName: "temperature", role: "color" }, index: 0 }]}
        />,
      );

      expect(screen.getByText("configuration.color.scale")).toBeInTheDocument();
      expect(screen.getByText("configuration.axes.title")).toBeInTheDocument();
      expect(screen.getByText("configuration.axes.titlePosition")).toBeInTheDocument();
      expect(screen.getByText("preview.title")).toBeInTheDocument();
    });
  });

  describe("Color Column Select", () => {
    it("should show all available columns when color select is opened", async () => {
      const user = userEvent.setup();
      render(<TestWrapper />);

      const colorSelect = screen.getByRole("combobox");
      await user.click(colorSelect);

      expect(screen.getByText("configuration.columns.noColorMapping")).toBeInTheDocument();
      expect(screen.getAllByText("temperature").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("humidity").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("pressure").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("location").length).toBeGreaterThanOrEqual(1);
    });

    it("should display column type badges in dropdown", async () => {
      const user = userEvent.setup();
      render(<TestWrapper />);

      const colorSelect = screen.getByRole("combobox");
      await user.click(colorSelect);

      expect(screen.getAllByText("DOUBLE").length).toBeGreaterThanOrEqual(3);
      expect(screen.getByText("VARCHAR")).toBeInTheDocument();
    });

    it("should call removeDataSource when changing color column", async () => {
      const user = userEvent.setup();
      const removeDataSource = vi.fn();
      render(
        <TestWrapper
          colorAxisDataSources={[{ field: { columnName: "temperature", role: "color" }, index: 0 }]}
          onRemoveDataSource={removeDataSource}
        />,
      );

      const colorSelects = screen.getAllByRole("combobox");
      const colorSelect = colorSelects[0]; // First combobox is the color select
      await user.click(colorSelect);
      await user.click(screen.getAllByText("humidity")[0]);

      expect(removeDataSource).toHaveBeenCalledWith(0);
    });

    it("should call appendDataSource when selecting a column", async () => {
      const user = userEvent.setup();
      const appendDataSource = vi.fn();
      render(<TestWrapper onAppendDataSource={appendDataSource} />);

      const colorSelect = screen.getByRole("combobox");
      await user.click(colorSelect);
      await user.click(screen.getAllByText("temperature")[0]);

      expect(appendDataSource).toHaveBeenCalledWith({
        tableName: "test-table",
        columnName: "temperature",
        role: "color",
        alias: "",
      });
    });

    it("should only call removeDataSource when selecting 'none'", async () => {
      const user = userEvent.setup();
      const removeDataSource = vi.fn();
      const appendDataSource = vi.fn();
      render(
        <TestWrapper
          colorAxisDataSources={[{ field: { columnName: "temperature", role: "color" }, index: 0 }]}
          onAppendDataSource={appendDataSource}
          onRemoveDataSource={removeDataSource}
        />,
      );

      const colorSelects = screen.getAllByRole("combobox");
      const colorSelect = colorSelects[0]; // First combobox is the color select
      await user.click(colorSelect);
      await user.click(screen.getByText("configuration.columns.noColorMapping"));

      expect(removeDataSource).toHaveBeenCalledWith(0);
      expect(appendDataSource).not.toHaveBeenCalled();
    });
  });

  describe("Colorscale Select", () => {
    it("should render colorscale select when color is configured", () => {
      render(
        <TestWrapper
          colorAxisDataSources={[{ field: { columnName: "temperature", role: "color" }, index: 0 }]}
        />,
      );

      expect(screen.getByText("configuration.color.scale")).toBeInTheDocument();
    });

    it("should show all 15 colorscale options when opened", async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper
          colorAxisDataSources={[{ field: { columnName: "temperature", role: "color" }, index: 0 }]}
        />,
      );

      const colorscaleSelects = screen.getAllByRole("combobox");
      const colorscaleSelect = colorscaleSelects[1]; // Second combobox is colorscale
      await user.click(colorscaleSelect);

      // Check all 15 colorscales are present (use getAllByText since they appear in trigger + options)
      expect(screen.getAllByText("colorscales.viridis").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("colorscales.plasma")).toBeInTheDocument();
      expect(screen.getByText("colorscales.inferno")).toBeInTheDocument();
      expect(screen.getByText("colorscales.magma")).toBeInTheDocument();
      expect(screen.getByText("colorscales.cividis")).toBeInTheDocument();
      expect(screen.getByText("colorscales.blues")).toBeInTheDocument();
      expect(screen.getByText("colorscales.greens")).toBeInTheDocument();
      expect(screen.getByText("colorscales.reds")).toBeInTheDocument();
      expect(screen.getByText("colorscales.oranges")).toBeInTheDocument();
      expect(screen.getByText("colorscales.purples")).toBeInTheDocument();
      expect(screen.getByText("colorscales.greys")).toBeInTheDocument();
      expect(screen.getByText("colorscales.hot")).toBeInTheDocument();
      expect(screen.getByText("colorscales.cool")).toBeInTheDocument();
      expect(screen.getByText("colorscales.rainbow")).toBeInTheDocument();
      expect(screen.getByText("colorscales.jet")).toBeInTheDocument();
    });

    it("should display gradient preview for each colorscale option", async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper
          colorAxisDataSources={[{ field: { columnName: "temperature", role: "color" }, index: 0 }]}
        />,
      );

      const colorscaleSelects = screen.getAllByRole("combobox");
      const colorscaleSelect = colorscaleSelects[1];
      await user.click(colorscaleSelect);

      // Check that gradient divs are rendered (each option has a gradient preview)
      const listbox = screen.getByRole("listbox");
      const gradientDivs = within(listbox).getAllByRole("option");

      // Should have 15 options
      expect(gradientDivs.length).toBeGreaterThanOrEqual(15);
    });
  });

  describe("Color Axis Title Input", () => {
    it("should render color axis title input when color is configured", () => {
      render(
        <TestWrapper
          colorAxisDataSources={[{ field: { columnName: "temperature", role: "color" }, index: 0 }]}
        />,
      );

      expect(
        screen.getByPlaceholderText("configuration.chart.enterColorAxisTitle"),
      ).toBeInTheDocument();
    });

    it("should allow typing in color axis title input", async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper
          colorAxisDataSources={[{ field: { columnName: "temperature", role: "color" }, index: 0 }]}
        />,
      );

      const titleInput = screen.getByPlaceholderText("configuration.chart.enterColorAxisTitle");
      await user.type(titleInput, "Temperature (°C)");

      expect(titleInput).toHaveValue("Temperature (°C)");
    });
  });

  describe("Position Select", () => {
    it("should render position select when color is configured", () => {
      render(
        <TestWrapper
          colorAxisDataSources={[{ field: { columnName: "temperature", role: "color" }, index: 0 }]}
        />,
      );

      expect(screen.getByText("configuration.axes.titlePosition")).toBeInTheDocument();
    });

    it("should show position options when opened", async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper
          colorAxisDataSources={[{ field: { columnName: "temperature", role: "color" }, index: 0 }]}
        />,
      );

      const positionSelects = screen.getAllByRole("combobox");
      const positionSelect = positionSelects[2]; // Third combobox is position
      await user.click(positionSelect);

      expect(screen.getByText("configuration.positions.top")).toBeInTheDocument();
      expect(screen.getAllByText("configuration.positions.right").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("configuration.positions.bottom")).toBeInTheDocument();
    });
  });

  describe("Show Colorbar Checkbox", () => {
    it("should render showscale checkbox when color is configured", () => {
      render(
        <TestWrapper
          colorAxisDataSources={[{ field: { columnName: "temperature", role: "color" }, index: 0 }]}
        />,
      );

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeInTheDocument();
    });

    it("should toggle showscale checkbox", async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper
          colorAxisDataSources={[{ field: { columnName: "temperature", role: "color" }, index: 0 }]}
        />,
      );

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeChecked();

      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();

      await user.click(checkbox);
      expect(checkbox).toBeChecked();
    });
  });

  describe("Color Scale Preview", () => {
    it("should render color scale preview when color is configured", () => {
      render(
        <TestWrapper
          colorAxisDataSources={[{ field: { columnName: "temperature", role: "color" }, index: 0 }]}
        />,
      );

      expect(screen.getByText("preview.title")).toBeInTheDocument();
    });

    it("should display gradient preview bar", () => {
      const { container } = render(
        <TestWrapper
          colorAxisDataSources={[{ field: { columnName: "temperature", role: "color" }, index: 0 }]}
        />,
      );

      // The preview div has a gradient background - check it exists
      const previewDiv = container.querySelector(".h-6.w-full.rounded.border");
      expect(previewDiv).toBeInTheDocument();
    });
  });

  describe("Conditional Rendering", () => {
    it("should hide all color configuration when no color column selected", () => {
      render(<TestWrapper />);

      // Only the section header and color column select should be visible
      expect(screen.getByText("configuration.color.dimensionConfig")).toBeInTheDocument();
      expect(screen.getByText("configuration.columns.color")).toBeInTheDocument();

      // Everything else should be hidden
      expect(screen.queryByText("configuration.chart.showColorbar")).not.toBeInTheDocument();
      expect(screen.queryByText("configuration.color.scale")).not.toBeInTheDocument();
      expect(screen.queryByText("configuration.axes.title")).not.toBeInTheDocument();
      expect(screen.queryByText("configuration.axes.titlePosition")).not.toBeInTheDocument();
      expect(screen.queryByText("preview.title")).not.toBeInTheDocument();
    });

    it("should show all color configuration when color column is selected", () => {
      render(
        <TestWrapper
          colorAxisDataSources={[{ field: { columnName: "temperature", role: "color" }, index: 0 }]}
        />,
      );

      // All elements should be visible
      expect(screen.getByText("configuration.color.dimensionConfig")).toBeInTheDocument();
      expect(screen.getByText("configuration.columns.color")).toBeInTheDocument();
      expect(screen.getByText("configuration.chart.showColorbar")).toBeInTheDocument();
      expect(screen.getByText("configuration.color.scale")).toBeInTheDocument();
      expect(screen.getByText("configuration.axes.title")).toBeInTheDocument();
      expect(screen.getByText("configuration.axes.titlePosition")).toBeInTheDocument();
      expect(screen.getByText("preview.title")).toBeInTheDocument();
    });

    it("should hide colorbar checkbox when color column name is empty", () => {
      render(
        <TestWrapper
          colorAxisDataSources={[{ field: { columnName: "", role: "color" }, index: 0 }]}
        />,
      );

      expect(screen.queryByText("configuration.chart.showColorbar")).not.toBeInTheDocument();
    });
  });
});
