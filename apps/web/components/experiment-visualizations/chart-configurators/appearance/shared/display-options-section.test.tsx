import { renderWithForm, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { ChartFormValues } from "../../chart-configurator-util";
import DisplayOptionsSection from "./display-options-section";

function renderDisplayOptions(defaultValues?: Partial<ChartFormValues>) {
  return renderWithForm<ChartFormValues>((form) => <DisplayOptionsSection form={form} />, {
    useFormProps: {
      defaultValues: {
        name: "",
        chartFamily: "basic",
        chartType: "line",
        config: {
          title: defaultValues?.config?.title ?? "",
          showLegend: defaultValues?.config?.showLegend ?? true,
          showGrid: defaultValues?.config?.showGrid ?? true,
        },
        dataConfig: {
          tableName: "",
          dataSources: [],
        },
      } as ChartFormValues,
    },
  });
}

describe("DisplayOptionsSection", () => {
  describe("Rendering", () => {
    it("should render display options section with header", () => {
      renderDisplayOptions();

      expect(screen.getByText(/displayOptions/i)).toBeInTheDocument();
    });

    it("should render Eye icon", () => {
      const { container } = renderDisplayOptions();

      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });

    it("should render chart title input field", () => {
      renderDisplayOptions();

      expect(screen.getByText(/configuration\.chartOptions\.title/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/enterChartTitle/i)).toBeInTheDocument();
    });

    it("should render show legend checkbox", () => {
      renderDisplayOptions();

      expect(screen.getByText(/configuration\.chartOptions\.showLegend/i)).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: /showLegend/i })).toBeInTheDocument();
    });

    it("should render show grid checkbox", () => {
      renderDisplayOptions();

      expect(screen.getByText(/configuration\.chartOptions\.gridLines/i)).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: /gridLines/i })).toBeInTheDocument();
    });
  });

  describe("Chart Title Input", () => {
    it("should display default empty title", () => {
      renderDisplayOptions();

      const input = screen.getByPlaceholderText(/enterChartTitle/i);
      expect(input).toHaveValue("");
    });

    it("should display provided title value", () => {
      renderDisplayOptions({ config: { title: "My Chart" } });

      const input = screen.getByPlaceholderText(/enterChartTitle/i);
      expect(input).toHaveValue("My Chart");
    });

    it("should allow typing in title input", async () => {
      const user = userEvent.setup();
      renderDisplayOptions();

      const input = screen.getByPlaceholderText(/enterChartTitle/i);
      await user.type(input, "Test Chart Title");

      expect(input).toHaveValue("Test Chart Title");
    });

    it("should allow clearing title input", async () => {
      const user = userEvent.setup();
      renderDisplayOptions({ config: { title: "Initial Title" } });

      const input = screen.getByPlaceholderText(/enterChartTitle/i);
      await user.clear(input);

      expect(input).toHaveValue("");
    });
  });

  describe("Show Legend Checkbox", () => {
    it("should be checked by default", () => {
      renderDisplayOptions();

      const checkbox = screen.getByRole("checkbox", { name: /showLegend/i });
      expect(checkbox).toBeChecked();
    });

    it("should reflect unchecked state when provided", () => {
      renderDisplayOptions({ config: { showLegend: false } });

      const checkbox = screen.getByRole("checkbox", { name: /showLegend/i });
      expect(checkbox).not.toBeChecked();
    });

    it("should toggle when clicked", async () => {
      const user = userEvent.setup();
      renderDisplayOptions();

      const checkbox = screen.getByRole("checkbox", { name: /showLegend/i });
      expect(checkbox).toBeChecked();

      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();

      await user.click(checkbox);
      expect(checkbox).toBeChecked();
    });
  });

  describe("Show Grid Checkbox", () => {
    it("should be checked by default", () => {
      renderDisplayOptions();

      const checkbox = screen.getByRole("checkbox", { name: /gridLines/i });
      expect(checkbox).toBeChecked();
    });

    it("should reflect unchecked state when provided", () => {
      renderDisplayOptions({ config: { showGrid: false } });

      const checkbox = screen.getByRole("checkbox", { name: /gridLines/i });
      expect(checkbox).not.toBeChecked();
    });

    it("should toggle when clicked", async () => {
      const user = userEvent.setup();
      renderDisplayOptions();

      const checkbox = screen.getByRole("checkbox", { name: /gridLines/i });
      expect(checkbox).toBeChecked();

      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();

      await user.click(checkbox);
      expect(checkbox).toBeChecked();
    });
  });

  describe("Form Integration", () => {
    it("should have all fields in proper form layout", () => {
      renderDisplayOptions();

      // Check that all form items are present
      const titleInput = screen.getByPlaceholderText(/enterChartTitle/i);
      const legendCheckbox = screen.getByRole("checkbox", { name: /showLegend/i });
      const gridCheckbox = screen.getByRole("checkbox", { name: /gridLines/i });

      expect(titleInput).toBeInTheDocument();
      expect(legendCheckbox).toBeInTheDocument();
      expect(gridCheckbox).toBeInTheDocument();
    });
  });
});
