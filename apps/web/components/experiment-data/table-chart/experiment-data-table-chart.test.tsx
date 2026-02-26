import { render, screen, userEvent } from "@/test/test-utils";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { ExperimentDataTableChart } from "./experiment-data-table-chart";

// Mock the LineChart component from @repo/ui/components
vi.mock("@repo/ui/components", async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal();
  return {
    ...actual,
    LineChart: vi.fn(({ data, config }: { data: unknown; config: unknown }) => (
      <div data-testid="line-chart" data-config={JSON.stringify(config)}>
        {JSON.stringify(data)}
      </div>
    )),
  };
});

interface ChartData {
  name: string;
  x: number[];
  y: number[];
  mode: string;
  line: { color: string };
}

interface ChartConfig {
  title: string;
  xAxisTitle: string;
  yAxisTitle: string;
  useWebGL: boolean;
}

describe("ExperimentDataTableChart", () => {
  const mockData = [1, 2, 3, 4, 5];
  const mockColumnName = "test_column";

  it("renders chart when visible and data is provided", () => {
    render(<ExperimentDataTableChart data={mockData} columnName={mockColumnName} visible={true} />);

    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
  });

  it("does not render when visible is false", () => {
    render(
      <ExperimentDataTableChart data={mockData} columnName={mockColumnName} visible={false} />,
    );

    expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
  });

  it("does not render when data is empty", () => {
    render(<ExperimentDataTableChart data={[]} columnName={mockColumnName} visible={true} />);

    expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
  });

  it("shows pin header when isClicked is true and onClose is provided", () => {
    const mockOnClose = vi.fn();

    render(
      <ExperimentDataTableChart
        data={mockData}
        columnName={mockColumnName}
        visible={true}
        isClicked={true}
        onClose={mockOnClose}
      />,
    );

    expect(screen.getByText(mockColumnName)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
  });

  it("does not show pin header when isClicked is false", () => {
    render(
      <ExperimentDataTableChart
        data={mockData}
        columnName={mockColumnName}
        visible={true}
        isClicked={false}
      />,
    );

    expect(screen.queryByRole("button", { name: /close/i })).not.toBeInTheDocument();
  });

  it("does not show pin header when onClose is not provided", () => {
    render(
      <ExperimentDataTableChart
        data={mockData}
        columnName={mockColumnName}
        visible={true}
        isClicked={true}
      />,
    );

    expect(screen.queryByRole("button", { name: /close/i })).not.toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const mockOnClose = vi.fn();

    render(
      <ExperimentDataTableChart
        data={mockData}
        columnName={mockColumnName}
        visible={true}
        isClicked={true}
        onClose={mockOnClose}
      />,
    );

    const closeButton = screen.getByRole("button", { name: /close/i });
    await userEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it("passes correct data to LineChart component", () => {
    render(<ExperimentDataTableChart data={mockData} columnName={mockColumnName} visible={true} />);

    const lineChart = screen.getByTestId("line-chart");
    const chartData = JSON.parse(lineChart.textContent) as ChartData[];

    expect(chartData).toHaveLength(1);
    const firstChart = chartData[0];
    expect(firstChart).toBeDefined();
    expect(firstChart.name).toBe(mockColumnName);
    expect(firstChart.x).toEqual([0, 1, 2, 3, 4]);
    expect(firstChart.y).toEqual(mockData);
    expect(firstChart.mode).toBe("lines");
    expect(firstChart.line.color).toBe("#0a4d4d");
  });

  it("passes correct config to LineChart component", () => {
    render(<ExperimentDataTableChart data={mockData} columnName={mockColumnName} visible={true} />);

    const lineChart = screen.getByTestId("line-chart");
    const config = JSON.parse(lineChart.getAttribute("data-config") ?? "{}") as ChartConfig;

    expect(config.title).toBe(`${mockColumnName} Data Series`);
    expect(config.xAxisTitle).toBe("Pulses");
    expect(config.yAxisTitle).toBe("Intensity");
    expect(config.useWebGL).toBe(false);
  });

  it("handles fallback column name when columnName is empty", () => {
    render(<ExperimentDataTableChart data={mockData} columnName="" visible={true} />);

    const lineChart = screen.getByTestId("line-chart");
    const chartData = JSON.parse(lineChart.textContent) as ChartData[];
    const config = JSON.parse(lineChart.getAttribute("data-config") ?? "{}") as ChartConfig;

    const firstChart = chartData[0];
    expect(firstChart).toBeDefined();
    expect(firstChart.name).toBe("Chart");
    expect(config.title).toBe("Chart Data Series");
  });

  it("shows pin icon when chart is pinned", () => {
    const mockOnClose = vi.fn();

    render(
      <ExperimentDataTableChart
        data={mockData}
        columnName={mockColumnName}
        visible={true}
        isClicked={true}
        onClose={mockOnClose}
      />,
    );

    // Check that Pin icon is rendered (it should be in the DOM)
    const pinIcon = document.querySelector(".lucide-pin");
    expect(pinIcon).toBeInTheDocument();
  });

  it("applies correct container styling", () => {
    render(<ExperimentDataTableChart data={mockData} columnName={mockColumnName} visible={true} />);

    const container = screen.getByTestId("line-chart").parentElement?.parentElement;
    expect(container).toHaveClass("bg-background");
    expect(container).toHaveClass("w-full");
    expect(container).toHaveClass("rounded-lg");
    expect(container).toHaveClass("border");
    expect(container).toHaveClass("p-4");
    expect(container).toHaveClass("shadow-lg");
  });

  it("applies correct chart container height", () => {
    render(<ExperimentDataTableChart data={mockData} columnName={mockColumnName} visible={true} />);

    const chartContainer = screen.getByTestId("line-chart").parentElement;
    expect(chartContainer).toHaveClass("h-[460px]");
    expect(chartContainer).toHaveClass("w-full");
  });
});
