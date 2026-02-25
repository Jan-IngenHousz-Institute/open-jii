import { render, screen } from "@/test/test-utils";
import { userEvent } from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import type { ChartFormValues } from "../../../chart-configurator-util";
import LineChartAppearanceConfigurator from "./line-chart-appearance-configurator";

vi.mock("../../shared/display-options-section", () => ({
  default: vi.fn(() => <div data-testid="display-options-section">Display Options</div>),
}));

HTMLElement.prototype.hasPointerCapture = () => false;
HTMLElement.prototype.scrollIntoView = () => {};

describe("LineChartAppearanceConfigurator", () => {
  it("should render display options section", () => {
    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "lines",
            connectgaps: false,
            line: { smoothing: 0 },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <LineChartAppearanceConfigurator form={form} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    expect(screen.getByTestId("display-options-section")).toBeInTheDocument();
  });

  it("should render line chart options section header", () => {
    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "lines",
            connectgaps: false,
            line: { smoothing: 0 },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <LineChartAppearanceConfigurator form={form} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    expect(screen.getByText(/lineChartOptions/i)).toBeInTheDocument();
  });

  it("should render mode select field", () => {
    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "lines",
            connectgaps: false,
            line: { smoothing: 0 },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <LineChartAppearanceConfigurator form={form} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    expect(screen.getByRole("combobox")).toBeInTheDocument();
    // Check for the label specifically
    expect(screen.getByText(/chartOptions\.mode/i)).toBeInTheDocument();
  });

  it("should display selected mode value", () => {
    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "markers",
            connectgaps: false,
            line: { smoothing: 0 },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <LineChartAppearanceConfigurator form={form} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    expect(screen.getByRole("combobox")).toHaveTextContent(/markers/i);
  });

  it("should allow changing mode value", async () => {
    const user = userEvent.setup();

    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "lines",
            connectgaps: false,
            line: { smoothing: 0 },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <LineChartAppearanceConfigurator form={form} />
          <div data-testid="current-mode">{form.watch("config.mode")}</div>
        </FormProvider>
      );
    }

    render(<TestComponent />);

    expect(screen.getByTestId("current-mode")).toHaveTextContent("lines");

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText(/^configuration\.modes\.markers$/i));

    expect(screen.getByTestId("current-mode")).toHaveTextContent("markers");
  });

  it("should render all mode options", async () => {
    const user = userEvent.setup();

    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "lines",
            connectgaps: false,
            line: { smoothing: 0 },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <LineChartAppearanceConfigurator form={form} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    await user.click(screen.getByRole("combobox"));

    // Check that all three options are present in the dropdown
    const linesOptions = screen.getAllByText(/^configuration\.modes\.lines$/i);
    expect(linesOptions.length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText(/^configuration\.modes\.markers$/i)).toBeInTheDocument();
    expect(screen.getByText(/^configuration\.modes\.linesMarkers$/i)).toBeInTheDocument();
  });

  it("should render connect gaps checkbox", () => {
    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "lines",
            connectgaps: false,
            line: { smoothing: 0 },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <LineChartAppearanceConfigurator form={form} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    expect(screen.getByRole("checkbox")).toBeInTheDocument();
    expect(screen.getByText(/connectGaps/i)).toBeInTheDocument();
  });

  it("should display unchecked connect gaps by default", () => {
    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "lines",
            connectgaps: false,
            line: { smoothing: 0 },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <LineChartAppearanceConfigurator form={form} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("should display checked connect gaps when true", () => {
    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "lines",
            connectgaps: true,
            line: { smoothing: 0 },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <LineChartAppearanceConfigurator form={form} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("should toggle connect gaps checkbox", async () => {
    const user = userEvent.setup();

    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "lines",
            connectgaps: false,
            line: { smoothing: 0 },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <LineChartAppearanceConfigurator form={form} />
          <div data-testid="connectgaps-value">
            {form.watch("config.connectgaps") ? "true" : "false"}
          </div>
        </FormProvider>
      );
    }

    render(<TestComponent />);

    expect(screen.getByTestId("connectgaps-value")).toHaveTextContent("false");

    await user.click(screen.getByRole("checkbox"));

    expect(screen.getByTestId("connectgaps-value")).toHaveTextContent("true");
  });

  it("should render smoothing slider", () => {
    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "lines",
            connectgaps: false,
            line: { smoothing: 0 },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <LineChartAppearanceConfigurator form={form} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    expect(screen.getByText(/smoothing/i)).toBeInTheDocument();
    expect(screen.getByRole("slider")).toBeInTheDocument();
  });

  it("should display smoothing percentage badge", () => {
    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "lines",
            connectgaps: false,
            line: { smoothing: 0.5 },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <LineChartAppearanceConfigurator form={form} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("should display 0% when smoothing is 0", () => {
    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "lines",
            connectgaps: false,
            line: { smoothing: 0 },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <LineChartAppearanceConfigurator form={form} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("should display 100% when smoothing is 1", () => {
    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "lines",
            connectgaps: false,
            line: { smoothing: 1 },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <LineChartAppearanceConfigurator form={form} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("should round smoothing percentage to nearest integer", () => {
    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "lines",
            connectgaps: false,
            line: { smoothing: 0.374 },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <LineChartAppearanceConfigurator form={form} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    expect(screen.getByText("37%")).toBeInTheDocument();
  });

  it("should handle undefined smoothing value", () => {
    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "lines",
            connectgaps: false,
            line: { smoothing: undefined },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <LineChartAppearanceConfigurator form={form} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("should have correct slider attributes", () => {
    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          config: {
            mode: "lines",
            connectgaps: false,
            line: { smoothing: 0 },
          },
        },
      });

      return (
        <FormProvider {...form}>
          <LineChartAppearanceConfigurator form={form} />
        </FormProvider>
      );
    }

    render(<TestComponent />);

    const slider = screen.getByRole("slider");
    expect(slider).toHaveAttribute("aria-valuemin", "0");
    expect(slider).toHaveAttribute("aria-valuemax", "1");
    expect(slider).toHaveAttribute("aria-valuenow", "0");
  });
});
