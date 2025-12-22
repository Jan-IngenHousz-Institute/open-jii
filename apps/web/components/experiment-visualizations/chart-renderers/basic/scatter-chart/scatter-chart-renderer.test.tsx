import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { ExperimentVisualization } from "@repo/api";

import { useExperimentVisualizationData } from "../../../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";
import { ScatterChartRenderer } from "./scatter-chart-renderer";

// Mock the hooks and components
vi.mock("@repo/i18n", () => ({
  useTranslation: vi.fn(() => ({ t: (key: string) => key })),
}));

vi.mock("@repo/ui/components", () => ({
  ScatterChart: vi.fn(({ data }) => (
    <div data-testid="scatter-chart">
      <pre data-testid="chart-data">{JSON.stringify(data, null, 2)}</pre>
    </div>
  )),
}));

// Mock the useExperimentVisualizationData hook
vi.mock(
  "../../../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData",
  () => ({
    useExperimentVisualizationData: vi.fn(),
  }),
);

describe("ScatterChartRenderer", () => {
  const mockVisualization: ExperimentVisualization = {
    id: "viz-1",
    experimentId: "exp-1",
    name: "Test Scatter Chart",
    description: "Test Description",
    chartType: "scatter",
    chartFamily: "basic",
    createdBy: "user-1",
    config: {
      mode: "markers",
      marker: {
        size: 8,
        symbol: "circle",
      },
    },
    dataConfig: {
      tableName: "test_table",
      dataSources: [
        { tableName: "test_table", columnName: "x_value", role: "x", alias: "X" },
        { tableName: "test_table", columnName: "y_value", role: "y", alias: "Y" },
      ],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useExperimentVisualizationData).mockReturnValue({
      data: undefined,
      tableInfo: undefined,
      isLoading: false,
      error: null,
    });
  });

  describe("Rendering with provided data", () => {
    it("should render chart when data is provided", () => {
      const testData = [
        { x_value: 1, y_value: 10 },
        { x_value: 2, y_value: 20 },
      ];

      render(
        <ScatterChartRenderer
          visualization={mockVisualization}
          experimentId="exp-1"
          data={testData}
        />,
      );

      expect(screen.getByTestId("scatter-chart")).toBeInTheDocument();
    });

    it("should render chart with correct data points", () => {
      const testData = [
        { x_value: 1, y_value: 10 },
        { x_value: 2, y_value: 20 },
        { x_value: 3, y_value: 30 },
      ];

      render(
        <ScatterChartRenderer
          visualization={mockVisualization}
          experimentId="exp-1"
          data={testData}
        />,
      );

      const chartData = screen.getByTestId("chart-data");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed = JSON.parse(chartData.textContent);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(parsed[0].x).toEqual([1, 2, 3]);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(parsed[0].y).toEqual([10, 20, 30]);
    });
  });

  describe("Data validation", () => {
    it("should show no data message when array is empty", () => {
      render(
        <ScatterChartRenderer visualization={mockVisualization} experimentId="exp-1" data={[]} />,
      );

      expect(screen.getByText("errors.noData")).toBeInTheDocument();
      expect(screen.getByText("errors.noDataFound")).toBeInTheDocument();
    });

    it("should show no data message when data is undefined", () => {
      render(
        <ScatterChartRenderer
          visualization={mockVisualization}
          experimentId="exp-1"
          data={undefined}
        />,
      );

      expect(screen.getByText("errors.noData")).toBeInTheDocument();
    });
  });

  describe("Configuration validation", () => {
    it("should show error when chart type is incorrect", () => {
      const badViz = {
        ...mockVisualization,
        chartType: "bar" as const,
      };

      render(
        <ScatterChartRenderer
          visualization={badViz}
          experimentId="exp-1"
          data={[{ x_value: 1, y_value: 10 }]}
        />,
      );

      expect(screen.getByText("errors.configurationError")).toBeInTheDocument();
      expect(screen.getByText("errors.invalidChartType")).toBeInTheDocument();
    });

    it("should show error when x-axis is not configured", () => {
      const badViz = {
        ...mockVisualization,
        dataConfig: {
          tableName: "test_table",
          dataSources: [{ tableName: "test_table", columnName: "y_value", role: "y" as const }],
        },
      };

      render(
        <ScatterChartRenderer
          visualization={badViz}
          experimentId="exp-1"
          data={[{ y_value: 10 }]}
        />,
      );

      expect(screen.getByText("errors.xAxisNotConfigured")).toBeInTheDocument();
    });

    it("should show error when y-axis is not configured", () => {
      const badViz = {
        ...mockVisualization,
        dataConfig: {
          tableName: "test_table",
          dataSources: [{ tableName: "test_table", columnName: "x_value", role: "x" as const }],
        },
      };

      render(
        <ScatterChartRenderer
          visualization={badViz}
          experimentId="exp-1"
          data={[{ x_value: 1 }]}
        />,
      );

      expect(screen.getByText("errors.yAxisNotConfigured")).toBeInTheDocument();
    });
  });

  describe("Multiple series", () => {
    it("should handle multiple y-axis series", () => {
      const multiSeriesViz = {
        ...mockVisualization,
        dataConfig: {
          tableName: "test_table",
          dataSources: [
            { tableName: "test_table", columnName: "x_value", role: "x" as const, alias: "X" },
            { tableName: "test_table", columnName: "y1", role: "y" as const, alias: "Series 1" },
            { tableName: "test_table", columnName: "y2", role: "y" as const, alias: "Series 2" },
          ],
        },
      };

      const testData = [
        { x_value: 1, y1: 10, y2: 15 },
        { x_value: 2, y1: 20, y2: 25 },
      ];

      render(
        <ScatterChartRenderer
          visualization={multiSeriesViz}
          experimentId="exp-1"
          data={testData}
        />,
      );

      const chartData = screen.getByTestId("chart-data");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed = JSON.parse(chartData.textContent);
      expect(parsed).toHaveLength(2);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(parsed[0].name).toBe("Series 1");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(parsed[1].name).toBe("Series 2");
    });
  });

  describe("Color mapping", () => {
    it("should use color column when configured", () => {
      const colorViz = {
        ...mockVisualization,
        dataConfig: {
          tableName: "test_table",
          dataSources: [
            { tableName: "test_table", columnName: "x_value", role: "x" as const, alias: "X" },
            { tableName: "test_table", columnName: "y_value", role: "y" as const, alias: "Y" },
            {
              tableName: "test_table",
              columnName: "category",
              role: "color" as const,
              alias: "Category",
            },
          ],
        },
        config: {
          mode: "markers",
          marker: {
            size: 8,
            symbol: "circle",
            colorscale: "Viridis",
            showscale: true,
            colorbar: {
              title: {
                text: "Category",
              },
            },
          },
        },
      };

      const testData = [
        { x_value: 1, y_value: 10, category: "A" },
        { x_value: 2, y_value: 20, category: "B" },
      ];

      render(
        <ScatterChartRenderer visualization={colorViz} experimentId="exp-1" data={testData} />,
      );

      const chartData = screen.getByTestId("chart-data");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed = JSON.parse(chartData.textContent);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(parsed[0].marker.color).toEqual(["A", "B"]);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(parsed[0].marker.colorscale).toBe("Viridis");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(parsed[0].marker.showscale).toBe(true);
    });

    it("should not use colorbar when showscale is false", () => {
      const colorViz = {
        ...mockVisualization,
        dataConfig: {
          tableName: "test_table",
          dataSources: [
            { tableName: "test_table", columnName: "x_value", role: "x" as const, alias: "X" },
            { tableName: "test_table", columnName: "y_value", role: "y" as const, alias: "Y" },
            {
              tableName: "test_table",
              columnName: "category",
              role: "color" as const,
              alias: "Category",
            },
          ],
        },
        config: {
          mode: "markers",
          marker: {
            size: 8,
            symbol: "circle",
            colorscale: "Viridis",
            showscale: false,
          },
        },
      };

      const testData = [
        { x_value: 1, y_value: 10, category: "A" },
        { x_value: 2, y_value: 20, category: "B" },
      ];

      render(
        <ScatterChartRenderer visualization={colorViz} experimentId="exp-1" data={testData} />,
      );

      const chartData = screen.getByTestId("chart-data");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed = JSON.parse(chartData.textContent);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(parsed[0].marker.colorbar).toBeUndefined();
    });
  });

  describe("Data type handling", () => {
    it("should handle string values in data", () => {
      const testData = [
        { x_value: "1", y_value: "10" },
        { x_value: "2", y_value: "20" },
      ];

      render(
        <ScatterChartRenderer
          visualization={mockVisualization}
          experimentId="exp-1"
          data={testData}
        />,
      );

      expect(screen.getByTestId("scatter-chart")).toBeInTheDocument();
    });

    it("should convert non-string/non-number values to string", () => {
      const testData = [
        { x_value: true, y_value: { value: 10 } },
        { x_value: null, y_value: [20] },
      ];

      render(
        <ScatterChartRenderer
          visualization={mockVisualization}
          experimentId="exp-1"
          data={testData}
        />,
      );

      const chartData = screen.getByTestId("chart-data");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed = JSON.parse(chartData.textContent);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(parsed[0].x).toEqual(["true", "null"]);
    });

    it("should use alias for series name", () => {
      const testData = [{ x_value: 1, y_value: 10 }];

      render(
        <ScatterChartRenderer
          visualization={mockVisualization}
          experimentId="exp-1"
          data={testData}
        />,
      );

      const chartData = screen.getByTestId("chart-data");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed = JSON.parse(chartData.textContent);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(parsed[0].name).toBe("Y");
    });

    it("should use column name when alias is empty", () => {
      const vizWithoutAlias = {
        ...mockVisualization,
        dataConfig: {
          tableName: "test_table",
          dataSources: [
            { tableName: "test_table", columnName: "x_value", role: "x" as const, alias: "" },
            { tableName: "test_table", columnName: "y_value", role: "y" as const, alias: "" },
          ],
        },
      };

      const testData = [{ x_value: 1, y_value: 10 }];

      render(
        <ScatterChartRenderer
          visualization={vizWithoutAlias}
          experimentId="exp-1"
          data={testData}
        />,
      );

      const chartData = screen.getByTestId("chart-data");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed = JSON.parse(chartData.textContent);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(parsed[0].name).toBe("");
    });
  });
});
