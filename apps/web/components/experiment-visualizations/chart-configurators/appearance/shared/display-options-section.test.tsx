import { render, screen, userEvent } from "@/test/test-utils";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import type { ChartFormValues } from "../../chart-configurator-util";
import DisplayOptionsSection from "./display-options-section";

// Test wrapper component with form context
function TestWrapper({ defaultValues }: { defaultValues?: Partial<ChartFormValues> }) {
  const methods = useForm<ChartFormValues>({
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
  });

  return (
    <FormProvider {...methods}>
      <DisplayOptionsSection form={methods} />
    </FormProvider>
  );
}

describe("DisplayOptionsSection", () => {
  describe("Rendering", () => {
    it("should render display options section with header", () => {
      render(<TestWrapper />);

      expect(screen.getByText(/displayOptions/i)).toBeInTheDocument();
    });

    it("should render Eye icon", () => {
      const { container } = render(<TestWrapper />);

      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });

    it("should render chart title input field", () => {
      render(<TestWrapper />);

      expect(screen.getByText(/configuration\.chartOptions\.title/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/enterChartTitle/i)).toBeInTheDocument();
    });

    it("should render show legend checkbox", () => {
      render(<TestWrapper />);

      expect(screen.getByText(/configuration\.chartOptions\.showLegend/i)).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: /showLegend/i })).toBeInTheDocument();
    });

    it("should render show grid checkbox", () => {
      render(<TestWrapper />);

      expect(screen.getByText(/configuration\.chartOptions\.gridLines/i)).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: /gridLines/i })).toBeInTheDocument();
    });
  });

  describe("Chart Title Input", () => {
    it("should display default empty title", () => {
      render(<TestWrapper />);

      const input = screen.getByPlaceholderText(/enterChartTitle/i);
      expect(input).toHaveValue("");
    });

    it("should display provided title value", () => {
      render(<TestWrapper defaultValues={{ config: { title: "My Chart" } }} />);

      const input = screen.getByPlaceholderText(/enterChartTitle/i);
      expect(input).toHaveValue("My Chart");
    });

    it("should allow typing in title input", async () => {
      const user = userEvent.setup();
      render(<TestWrapper />);

      const input = screen.getByPlaceholderText(/enterChartTitle/i);
      await user.type(input, "Test Chart Title");

      expect(input).toHaveValue("Test Chart Title");
    });

    it("should allow clearing title input", async () => {
      const user = userEvent.setup();
      render(<TestWrapper defaultValues={{ config: { title: "Initial Title" } }} />);

      const input = screen.getByPlaceholderText(/enterChartTitle/i);
      await user.clear(input);

      expect(input).toHaveValue("");
    });
  });

  describe("Show Legend Checkbox", () => {
    it("should be checked by default", () => {
      render(<TestWrapper />);

      const checkbox = screen.getByRole("checkbox", { name: /showLegend/i });
      expect(checkbox).toBeChecked();
    });

    it("should reflect unchecked state when provided", () => {
      render(<TestWrapper defaultValues={{ config: { showLegend: false } }} />);

      const checkbox = screen.getByRole("checkbox", { name: /showLegend/i });
      expect(checkbox).not.toBeChecked();
    });

    it("should toggle when clicked", async () => {
      const user = userEvent.setup();
      render(<TestWrapper />);

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
      render(<TestWrapper />);

      const checkbox = screen.getByRole("checkbox", { name: /gridLines/i });
      expect(checkbox).toBeChecked();
    });

    it("should reflect unchecked state when provided", () => {
      render(<TestWrapper defaultValues={{ config: { showGrid: false } }} />);

      const checkbox = screen.getByRole("checkbox", { name: /gridLines/i });
      expect(checkbox).not.toBeChecked();
    });

    it("should toggle when clicked", async () => {
      const user = userEvent.setup();
      render(<TestWrapper />);

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
      render(<TestWrapper />);

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
