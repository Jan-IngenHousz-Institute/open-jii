import { render, screen, userEvent } from "@/test/test-utils";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { ExperimentDataTableChart } from "./experiment-data-table-chart";

// Mock the LineChart component from @repo/ui/components
vi.mock("@repo/ui/components/charts/line-chart", async (importOriginal) => {
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
    const user = userEvent.setup();
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
    await user.click(closeButton);

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
  });

  it("takes the series colour from the theme's first chart slot", () => {
    // Plotly needs a concrete value, so the token is resolved rather than
    // passed as `var()`; setting it here proves the series tracks the token
    // instead of a colour baked into the component.
    const root = document.documentElement;
    root.style.setProperty("--chart-1", "oklch(0.5551 0.0516 190.6334)");
    try {
      render(
        <ExperimentDataTableChart data={mockData} columnName={mockColumnName} visible={true} />,
      );
      const chartData = JSON.parse(screen.getByTestId("line-chart").textContent) as ChartData[];
      expect(chartData[0]?.line.color).toBe("#4e7d7a");
    } finally {
      root.style.removeProperty("--chart-1");
    }
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

    const pinIcon = document.querySelector(".lucide-pin");
    expect(pinIcon).toBeInTheDocument();
  });

  it("renders the chart on a card surface", () => {
    render(<ExperimentDataTableChart data={mockData} columnName={mockColumnName} visible={true} />);

    const container = screen.getByTestId("line-chart").parentElement?.parentElement;
    // The surface is the Card primitive's; width and padding are this
    // component's own layout.
    expect(container).toHaveClass("bg-card");
    expect(container).toHaveClass("rounded-xl");
    expect(container).toHaveClass("border");
    expect(container).toHaveClass("shadow-sm");
    expect(container).toHaveClass("w-full");
    expect(container).toHaveClass("p-4");
  });

  it("applies correct chart container height", () => {
    render(<ExperimentDataTableChart data={mockData} columnName={mockColumnName} visible={true} />);

    const chartContainer = screen.getByTestId("line-chart").parentElement;
    expect(chartContainer).toHaveClass("h-[460px]");
    expect(chartContainer).toHaveClass("w-full");
  });
});
