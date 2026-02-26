import { render, screen } from "@/test/test-utils";
import { useForm } from "react-hook-form";
import { describe, it, expect, vi } from "vitest";

import type { ChartFormValues } from "../../../chart-configurator-util";
import LineChartDataConfigurator from "./line-chart-data-configurator";

// Mock the shared configuration components
vi.mock("../../shared/x-axis-configuration", () => ({
  default: vi.fn(() => <div data-testid="x-axis-configuration">X Axis Config</div>),
}));

let capturedAddYAxisSeries: (() => void) | null = null;
let capturedIsColorColumnSelected: boolean | undefined;

vi.mock("../../shared/y-axis-configuration", () => ({
  default: vi.fn((props: { addYAxisSeries: () => void; isColorColumnSelected: boolean }) => {
    capturedAddYAxisSeries = props.addYAxisSeries;
    capturedIsColorColumnSelected = props.isColorColumnSelected;
    return <div data-testid="y-axis-configuration">Y Axis Config</div>;
  }),
}));

describe("LineChartDataConfigurator", () => {
  const mockColumns = [
    { name: "time", type_name: "number", type_text: "number" },
    { name: "value", type_name: "number", type_text: "number" },
    { name: "category", type_name: "string", type_text: "string" },
  ];

  it("should render X-axis configuration component", () => {
    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          dataConfig: {
            tableName: "test_table",
            dataSources: [{ tableName: "test_table", columnName: "time", role: "x", alias: "" }],
          },
        },
      });

      return <LineChartDataConfigurator form={form} columns={mockColumns} />;
    }

    render(<TestComponent />);

    expect(screen.getByTestId("x-axis-configuration")).toBeInTheDocument();
  });

  it("should render Y-axis configuration component", () => {
    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          dataConfig: {
            tableName: "test_table",
            dataSources: [
              { tableName: "test_table", columnName: "time", role: "x", alias: "" },
              { tableName: "test_table", columnName: "value", role: "y", alias: "Value" },
            ],
          },
        },
      });

      return <LineChartDataConfigurator form={form} columns={mockColumns} />;
    }

    render(<TestComponent />);

    expect(screen.getByTestId("y-axis-configuration")).toBeInTheDocument();
  });

  it("should render both configuration components", () => {
    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          dataConfig: {
            tableName: "test_table",
            dataSources: [
              { tableName: "test_table", columnName: "time", role: "x", alias: "" },
              { tableName: "test_table", columnName: "value", role: "y", alias: "Value" },
            ],
          },
        },
      });

      return <LineChartDataConfigurator form={form} columns={mockColumns} />;
    }

    render(<TestComponent />);

    expect(screen.getByTestId("x-axis-configuration")).toBeInTheDocument();
    expect(screen.getByTestId("y-axis-configuration")).toBeInTheDocument();
  });

  it("should provide addYAxisSeries function to Y-axis configuration", () => {
    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          dataConfig: {
            tableName: "test_table",
            dataSources: [
              { tableName: "test_table", columnName: "time", role: "x", alias: "" },
              { tableName: "test_table", columnName: "value", role: "y", alias: "Value" },
            ],
          },
        },
      });

      return <LineChartDataConfigurator form={form} columns={mockColumns} />;
    }

    render(<TestComponent />);

    // Verify the addYAxisSeries function was captured and can be called
    expect(capturedAddYAxisSeries).toBeTruthy();
    expect(() => capturedAddYAxisSeries?.()).not.toThrow();
  });

  it("should pass isColorColumnSelected as true when color column is configured", () => {
    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          dataConfig: {
            tableName: "test_table",
            dataSources: [
              { tableName: "test_table", columnName: "time", role: "x", alias: "" },
              { tableName: "test_table", columnName: "value", role: "y", alias: "Value" },
              { tableName: "test_table", columnName: "category", role: "color", alias: "" },
            ],
          },
        },
      });

      return <LineChartDataConfigurator form={form} columns={mockColumns} />;
    }

    render(<TestComponent />);

    expect(capturedIsColorColumnSelected).toBe(true);
  });

  it("should pass isColorColumnSelected as false when color column has no columnName", () => {
    function TestComponent() {
      const form = useForm<ChartFormValues>({
        defaultValues: {
          dataConfig: {
            tableName: "test_table",
            dataSources: [
              { tableName: "test_table", columnName: "time", role: "x", alias: "" },
              { tableName: "test_table", columnName: "value", role: "y", alias: "Value" },
              { tableName: "test_table", columnName: "", role: "color", alias: "" },
            ],
          },
        },
      });

      return <LineChartDataConfigurator form={form} columns={mockColumns} />;
    }

    render(<TestComponent />);

    expect(capturedIsColorColumnSelected).toBe(false);
  });
});
