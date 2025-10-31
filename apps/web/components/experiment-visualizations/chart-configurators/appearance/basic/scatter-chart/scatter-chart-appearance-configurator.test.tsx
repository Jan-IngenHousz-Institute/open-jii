import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { ChartFormValues } from "../../../chart-configurator-util";
import ScatterChartAppearanceConfigurator from "./scatter-chart-appearance-configurator";

// Mock the display options section
vi.mock("../../shared/display-options-section", () => ({
  default: vi.fn(() => <div data-testid="display-options-section">Display Options</div>),
}));

describe("ScatterChartAppearanceConfigurator", () => {
  beforeAll(() => {
    // Mock ResizeObserver for Radix UI components
    global.ResizeObserver = class ResizeObserver {
      observe() {
        // Mock implementation
      }
      unobserve() {
        // Mock implementation
      }
      disconnect() {
        // Mock implementation
      }
    };

    // Mock PointerEvent methods for Radix UI Select
    Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
      value: () => false,
      writable: true,
    });

    // Mock scrollIntoView for Radix UI Select
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      value: () => {
        // Mock implementation
      },
      writable: true,
    });
  });

  it("should render display options section", () => {
    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "markers",
            marker: { size: 6, symbol: "circle" },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <ScatterChartAppearanceConfigurator form={form} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    expect(screen.getByTestId("display-options-section")).toBeInTheDocument();
  });

  it("should render scatter chart options section header", () => {
    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "markers",
            marker: { size: 6, symbol: "circle" },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <ScatterChartAppearanceConfigurator form={form} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    expect(screen.getByText(/scatterChartOptions/i)).toBeInTheDocument();
  });

  it("should render mode select field", () => {
    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "markers",
            marker: { size: 6, symbol: "circle" },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <ScatterChartAppearanceConfigurator form={form} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/chartOptions\.mode/i)).toBeInTheDocument();
  });

  it("should display selected mode value", () => {
    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "lines+markers",
            marker: { size: 6, symbol: "circle" },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <ScatterChartAppearanceConfigurator form={form} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    expect(screen.getByText(/linesMarkers/i)).toBeInTheDocument();
  });

  it("should allow changing mode value", async () => {
    const user = userEvent.setup();

    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "markers",
            marker: { size: 6, symbol: "circle" },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <ScatterChartAppearanceConfigurator form={form} />
          <div data-testid="current-mode">{form.watch("config.mode")}</div>
        </FormProvider>
      );
    }

    render(<TestComponent />);

    expect(screen.getByTestId("current-mode")).toHaveTextContent("markers");

    const comboboxes = screen.getAllByRole("combobox");
    await user.click(comboboxes[0]);
    await user.click(screen.getByText(/^configuration\.modes\.linesMarkers$/i));

    expect(screen.getByTestId("current-mode")).toHaveTextContent("lines+markers");
  });

  it("should render mode options", async () => {
    const user = userEvent.setup();

    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "markers",
            marker: { size: 6, symbol: "circle" },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <ScatterChartAppearanceConfigurator form={form} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    const comboboxes = screen.getAllByRole("combobox");
    await user.click(comboboxes[0]);

    // Check that both mode options are present
    const markersOptions = screen.getAllByText(/^configuration\.modes\.markers$/i);
    expect(markersOptions.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/^configuration\.modes\.linesMarkers$/i)).toBeInTheDocument();
  });

  it("should render marker size slider", () => {
    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "markers",
            marker: { size: 6, symbol: "circle" },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <ScatterChartAppearanceConfigurator form={form} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    expect(screen.getByText(/markerSize/i)).toBeInTheDocument();
    expect(screen.getByRole("slider")).toBeInTheDocument();
  });

  it("should display marker size badge", () => {
    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "markers",
            marker: { size: 10, symbol: "circle" },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <ScatterChartAppearanceConfigurator form={form} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    expect(screen.getByText("10px")).toBeInTheDocument();
  });

  it("should have correct slider attributes", () => {
    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "markers",
            marker: { size: 6, symbol: "circle" },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <ScatterChartAppearanceConfigurator form={form} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    const slider = screen.getByRole("slider");
    expect(slider).toHaveAttribute("aria-valuemin", "1");
    expect(slider).toHaveAttribute("aria-valuemax", "20");
    expect(slider).toHaveAttribute("aria-valuenow", "6");
  });

  it("should render marker shape select field", () => {
    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "markers",
            marker: { size: 6, symbol: "circle" },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <ScatterChartAppearanceConfigurator form={form} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    expect(screen.getByText(/markerShape/i)).toBeInTheDocument();
    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes.length).toBeGreaterThanOrEqual(2);
  });

  it("should display selected marker shape", () => {
    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "markers",
            marker: { size: 6, symbol: "square" },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <ScatterChartAppearanceConfigurator form={form} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    expect(screen.getByText(/markerSymbols\.square/i)).toBeInTheDocument();
  });

  it("should allow changing marker shape", async () => {
    const user = userEvent.setup();

    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "markers",
            marker: { size: 6, symbol: "circle" },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <ScatterChartAppearanceConfigurator form={form} />
          <div data-testid="current-symbol">{form.watch("config.marker.symbol")}</div>
        </FormProvider>
      );
    }

    render(<TestComponent />);

    expect(screen.getByTestId("current-symbol")).toHaveTextContent("circle");

    const comboboxes = screen.getAllByRole("combobox");
    await user.click(comboboxes[1]); // Second combobox is marker shape
    await user.click(screen.getByText(/^configuration\.markerSymbols\.diamond$/i));

    expect(screen.getByTestId("current-symbol")).toHaveTextContent("diamond");
  });

  it("should render all marker shape options", async () => {
    const user = userEvent.setup();

    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "markers",
            marker: { size: 6, symbol: "circle" },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <ScatterChartAppearanceConfigurator form={form} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    const comboboxes = screen.getAllByRole("combobox");
    await user.click(comboboxes[1]); // Second combobox is marker shape

    // Check that all marker shape options are present
    expect(
      screen.getAllByText(/^configuration\.markerSymbols\.circle$/i).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/^configuration\.markerSymbols\.square$/i)).toBeInTheDocument();
    expect(screen.getByText(/^configuration\.markerSymbols\.diamond$/i)).toBeInTheDocument();
    expect(screen.getByText(/^configuration\.markerSymbols\.cross$/i)).toBeInTheDocument();
    expect(screen.getByText(/^configuration\.markerSymbols\.x$/i)).toBeInTheDocument();
  });

  it("should display default marker size of 6px", () => {
    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "markers",
            marker: { size: 6, symbol: "circle" },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <ScatterChartAppearanceConfigurator form={form} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    expect(screen.getByText("6px")).toBeInTheDocument();
  });

  it("should display minimum marker size of 1px", () => {
    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "markers",
            marker: { size: 1, symbol: "circle" },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <ScatterChartAppearanceConfigurator form={form} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    expect(screen.getByText("1px")).toBeInTheDocument();
  });

  it("should display maximum marker size of 20px", () => {
    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "markers",
            marker: { size: 20, symbol: "circle" },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <ScatterChartAppearanceConfigurator form={form} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    expect(screen.getByText("20px")).toBeInTheDocument();
  });

  it("should display default marker shape as circle", () => {
    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "markers",
            marker: { size: 6, symbol: "circle" },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <ScatterChartAppearanceConfigurator form={form} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    expect(screen.getByText(/markerSymbols\.circle/i)).toBeInTheDocument();
  });
});
