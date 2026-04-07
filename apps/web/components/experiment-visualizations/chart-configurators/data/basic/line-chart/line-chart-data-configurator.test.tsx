import { act, renderWithForm, screen } from "@/test/test-utils";
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

const mockColumns = [
  { name: "time", type_name: "number", type_text: "number" },
  { name: "value", type_name: "number", type_text: "number" },
  { name: "category", type_name: "string", type_text: "string" },
];

function renderLineDataConfigurator(
  dataSources: { tableName: string; columnName: string; role: string; alias: string }[],
) {
  return renderWithForm<ChartFormValues>(
    (form) => <LineChartDataConfigurator form={form} columns={mockColumns} />,
    {
      useFormProps: {
        defaultValues: {
          dataConfig: { tableName: "test_table", dataSources },
        } as ChartFormValues,
      },
    },
  );
}

describe("LineChartDataConfigurator", () => {
  it("should render X-axis configuration component", () => {
    renderLineDataConfigurator([
      { tableName: "test_table", columnName: "time", role: "x", alias: "" },
    ]);

    expect(screen.getByTestId("x-axis-configuration")).toBeInTheDocument();
  });

  it("should render Y-axis configuration component", () => {
    renderLineDataConfigurator([
      { tableName: "test_table", columnName: "time", role: "x", alias: "" },
      { tableName: "test_table", columnName: "value", role: "y", alias: "Value" },
    ]);

    expect(screen.getByTestId("y-axis-configuration")).toBeInTheDocument();
  });

  it("should render both configuration components", () => {
    renderLineDataConfigurator([
      { tableName: "test_table", columnName: "time", role: "x", alias: "" },
      { tableName: "test_table", columnName: "value", role: "y", alias: "Value" },
    ]);

    expect(screen.getByTestId("x-axis-configuration")).toBeInTheDocument();
    expect(screen.getByTestId("y-axis-configuration")).toBeInTheDocument();
  });

  it("should provide addYAxisSeries function to Y-axis configuration", () => {
    renderLineDataConfigurator([
      { tableName: "test_table", columnName: "time", role: "x", alias: "" },
      { tableName: "test_table", columnName: "value", role: "y", alias: "Value" },
    ]);

    // Verify the addYAxisSeries function was captured and can be called
    expect(capturedAddYAxisSeries).toBeTruthy();
    act(() => {
      capturedAddYAxisSeries?.();
    });
  });

  it("should pass isColorColumnSelected as true when color column is configured", () => {
    renderLineDataConfigurator([
      { tableName: "test_table", columnName: "time", role: "x", alias: "" },
      { tableName: "test_table", columnName: "value", role: "y", alias: "Value" },
      { tableName: "test_table", columnName: "category", role: "color", alias: "" },
    ]);

    expect(capturedIsColorColumnSelected).toBe(true);
  });

  it("should pass isColorColumnSelected as false when color column has no columnName", () => {
    renderLineDataConfigurator([
      { tableName: "test_table", columnName: "time", role: "x", alias: "" },
      { tableName: "test_table", columnName: "value", role: "y", alias: "Value" },
      { tableName: "test_table", columnName: "", role: "color", alias: "" },
    ]);

    expect(capturedIsColorColumnSelected).toBe(false);
  });
});
