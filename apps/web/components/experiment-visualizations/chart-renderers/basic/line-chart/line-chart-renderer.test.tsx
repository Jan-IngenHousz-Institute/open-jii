import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExperimentVisualization } from "@repo/api";

import * as useExperimentVisualizationDataModule from "../../../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";
import { LineChartRenderer } from "./line-chart-renderer";

// Mock the translation hook
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock the LineChart component from UI package
vi.mock("@repo/ui/components", () => ({
  LineChart: ({ data }: { data: unknown }) => (
    <div data-testid="line-chart">
      <pre data-testid="chart-data">{JSON.stringify(data, null, 2)}</pre>
    </div>
  ),
}));

// Mock the useExperimentVisualizationData hook
vi.mock(
  "../../../../../hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData",
);

describe("LineChartRenderer", () => {
  const mockVisualization: ExperimentVisualization = {
    id: "viz-1",
    name: "Test Line Chart",
    description: "Test Description",
    chartType: "line",
    chartFamily: "basic",
    experimentId: "exp-1",
    createdBy: "user-1",
    config: {
      title: "Test Chart",
      xAxisTitle: "X Axis",
      yAxisTitle: "Y Axis",
      mode: "lines",
    },
    dataConfig: {
      tableName: "test_table",
      dataSources: [
        { tableName: "test_table", columnName: "time", role: "x", alias: "Time" },
        { tableName: "test_table", columnName: "value", role: "y", alias: "Value" },
      ],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockData = [
    { time: 0, value: 10 },
    { time: 1, value: 20 },
    { time: 2, value: 15 },
    { time: 3, value: 25 },
  ];

  beforeEach(() => {
    vi.mocked(useExperimentVisualizationDataModule.useExperimentVisualizationData).mockReturnValue({
      data: undefined,
      tableInfo: undefined,
      isLoading: false,
      error: null,
    });
  });

  describe("Rendering with provided data", () => {
    it("should render chart when data is provided", () => {
      render(
        <LineChartRenderer
          visualization={mockVisualization}
          experimentId="exp-1"
          data={mockData}
        />,
      );

      expect(screen.getByTestId("line-chart")).toBeInTheDocument();
    });

    it("should render chart with correct data points", () => {
      render(
        <LineChartRenderer
          visualization={mockVisualization}
          experimentId="exp-1"
          data={mockData}
        />,
      );

      const chartDataElement = screen.getByTestId("chart-data");
      expect(chartDataElement.textContent).toContain('"x"');
      expect(chartDataElement.textContent).toContain('"y"');
    });
  });

  describe("Loading and error states", () => {
    it("should show loading message when data is loading", () => {
      vi.mocked(
        useExperimentVisualizationDataModule.useExperimentVisualizationData,
      ).mockReturnValue({
        data: undefined,
        tableInfo: undefined,
        isLoading: true,
        error: null,
      });

      render(<LineChartRenderer visualization={mockVisualization} experimentId="exp-1" />);

      expect(screen.getByText("errors.loadingData")).toBeInTheDocument();
    });

    it("should show error message when fetch fails", () => {
      vi.mocked(
        useExperimentVisualizationDataModule.useExperimentVisualizationData,
      ).mockReturnValue({
        data: undefined,
        tableInfo: undefined,
        isLoading: false,
        error: new Error("Failed to fetch"),
      });

      render(<LineChartRenderer visualization={mockVisualization} experimentId="exp-1" />);

      expect(screen.getByText("errors.failedToLoadData")).toBeInTheDocument();
      expect(screen.getByText("errors.failedToLoadDataDescription")).toBeInTheDocument();
    });

    it("should not show loading when data is provided", () => {
      vi.mocked(
        useExperimentVisualizationDataModule.useExperimentVisualizationData,
      ).mockReturnValue({
        data: undefined,
        tableInfo: undefined,
        isLoading: true,
        error: null,
      });

      render(
        <LineChartRenderer
          visualization={mockVisualization}
          experimentId="exp-1"
          data={mockData}
        />,
      );

      expect(screen.queryByText("errors.loadingData")).not.toBeInTheDocument();
      expect(screen.getByTestId("line-chart")).toBeInTheDocument();
    });

    it("should not show error when data is provided", () => {
      vi.mocked(
        useExperimentVisualizationDataModule.useExperimentVisualizationData,
      ).mockReturnValue({
        data: undefined,
        tableInfo: undefined,
        isLoading: false,
        error: new Error("Failed"),
      });

      render(
        <LineChartRenderer
          visualization={mockVisualization}
          experimentId="exp-1"
          data={mockData}
        />,
      );

      expect(screen.queryByText("errors.failedToLoadData")).not.toBeInTheDocument();
      expect(screen.getByTestId("line-chart")).toBeInTheDocument();
    });
  });

  describe("Data validation", () => {
    it("should show no data message when array is empty", () => {
      render(
        <LineChartRenderer visualization={mockVisualization} experimentId="exp-1" data={[]} />,
      );

      expect(screen.getByText("errors.noData")).toBeInTheDocument();
      expect(screen.getByText("errors.noDataFound")).toBeInTheDocument();
    });

    it("should use fetched data when available", () => {
      vi.mocked(
        useExperimentVisualizationDataModule.useExperimentVisualizationData,
      ).mockReturnValue({
        data: { rows: mockData, columns: [], totalRows: mockData.length, truncated: false },
        tableInfo: {
          name: "test_table",
          catalog_name: "catalog",
          schema_name: "schema",
          totalRows: mockData.length,
        },
        isLoading: false,
        error: null,
      });

      render(<LineChartRenderer visualization={mockVisualization} experimentId="exp-1" />);

      expect(screen.getByTestId("line-chart")).toBeInTheDocument();
    });
  });

  describe("Configuration validation", () => {
    it("should show error when chart type is incorrect", () => {
      const invalidViz = {
        ...mockVisualization,
        chartType: "scatter" as const,
      };

      render(<LineChartRenderer visualization={invalidViz} experimentId="exp-1" data={mockData} />);

      expect(screen.getByText("errors.configurationError")).toBeInTheDocument();
    });

    it("should show error when x-axis is not configured", () => {
      const invalidViz = {
        ...mockVisualization,
        dataConfig: {
          ...mockVisualization.dataConfig,
          dataSources: [{ tableName: "test_table", columnName: "value", role: "y", alias: "" }],
        },
      };

      render(<LineChartRenderer visualization={invalidViz} experimentId="exp-1" data={mockData} />);

      expect(screen.getByText("errors.xAxisNotConfigured")).toBeInTheDocument();
    });

    it("should show error when y-axis is not configured", () => {
      const invalidViz = {
        ...mockVisualization,
        dataConfig: {
          ...mockVisualization.dataConfig,
          dataSources: [{ tableName: "test_table", columnName: "time", role: "x", alias: "" }],
        },
      };

      render(<LineChartRenderer visualization={invalidViz} experimentId="exp-1" data={mockData} />);

      expect(screen.getByText("errors.yAxisNotConfigured")).toBeInTheDocument();
    });
  });

  describe("Multiple series", () => {
    it("should handle multiple y-axis series", () => {
      const multiSeriesViz = {
        ...mockVisualization,
        dataConfig: {
          ...mockVisualization.dataConfig,
          dataSources: [
            { tableName: "test_table", columnName: "time", role: "x", alias: "Time" },
            { tableName: "test_table", columnName: "value1", role: "y", alias: "Series 1" },
            { tableName: "test_table", columnName: "value2", role: "y", alias: "Series 2" },
          ],
        },
      };

      const multiSeriesData = [
        { time: 0, value1: 10, value2: 5 },
        { time: 1, value1: 20, value2: 15 },
      ];

      render(
        <LineChartRenderer
          visualization={multiSeriesViz}
          experimentId="exp-1"
          data={multiSeriesData}
        />,
      );

      const chartData = screen.getByTestId("chart-data");
      expect(chartData.textContent).toContain("Series 1");
      expect(chartData.textContent).toContain("Series 2");
    });
  });

  describe("Data type handling", () => {
    it("should handle string values in data", () => {
      const stringData = [
        { time: "0", value: "10" },
        { time: "1", value: "20" },
      ];

      render(
        <LineChartRenderer
          visualization={mockVisualization}
          experimentId="exp-1"
          data={stringData}
        />,
      );

      expect(screen.getByTestId("line-chart")).toBeInTheDocument();
    });

    it("should use alias for series names", () => {
      render(
        <LineChartRenderer
          visualization={mockVisualization}
          experimentId="exp-1"
          data={mockData}
        />,
      );

      const chartData = screen.getByTestId("chart-data");
      expect(chartData.textContent).toContain("Value");
    });

    it("should use column name when alias is empty", () => {
      const vizWithoutAlias = {
        ...mockVisualization,
        dataConfig: {
          ...mockVisualization.dataConfig,
          dataSources: [
            { tableName: "test_table", columnName: "time", role: "x", alias: "" },
            { tableName: "test_table", columnName: "value", role: "y", alias: "" },
          ],
        },
      };

      render(
        <LineChartRenderer visualization={vizWithoutAlias} experimentId="exp-1" data={mockData} />,
      );

      const chartData = screen.getByTestId("chart-data");
      // When alias is empty, the code uses alias ?? columnName, so it will use empty string
      expect(chartData.textContent).toContain('"name": ""');
    });

    it("should handle object x-values as fallback 0", () => {
      const dataWithObjectX = [
        { time: { nested: "value" }, value: 10 },
        { time: ["array"], value: 20 },
      ];

      render(
        <LineChartRenderer
          visualization={mockVisualization}
          experimentId="exp-1"
          data={dataWithObjectX}
        />,
      );

      expect(screen.getByTestId("line-chart")).toBeInTheDocument();
    });

    it("should handle non-parseable y-values as 0", () => {
      const dataWithBadY = [
        { time: 0, value: {} },
        { time: 1, value: [] },
        { time: 2, value: true },
      ];

      render(
        <LineChartRenderer
          visualization={mockVisualization}
          experimentId="exp-1"
          data={dataWithBadY}
        />,
      );

      expect(screen.getByTestId("line-chart")).toBeInTheDocument();
    });

    it("should parse string y-values as numbers", () => {
      const dataWithStringNumbers = [
        { time: 0, value: "10" },
        { time: 1, value: "20.5" },
        { time: 2, value: "30" },
      ];

      render(
        <LineChartRenderer
          visualization={mockVisualization}
          experimentId="exp-1"
          data={dataWithStringNumbers}
        />,
      );

      const chartData = screen.getByTestId("chart-data");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed = JSON.parse(chartData.textContent ?? "{}");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(parsed[0].y).toEqual([10, 20.5, 30]);
    });

    it("should use array colors when provided in config", () => {
      const vizWithArrayColors = {
        ...mockVisualization,
        config: {
          ...mockVisualization.config,
          color: ["#ff0000", "#00ff00"],
        },
        dataConfig: {
          ...mockVisualization.dataConfig,
          dataSources: [
            { tableName: "test_table", columnName: "time", role: "x", alias: "" },
            { tableName: "test_table", columnName: "value1", role: "y", alias: "Series 1" },
            { tableName: "test_table", columnName: "value2", role: "y", alias: "Series 2" },
          ],
        },
      };

      const dataWithMultipleSeries = [
        { time: 0, value1: 10, value2: 5 },
        { time: 1, value1: 20, value2: 15 },
      ];

      render(
        <LineChartRenderer
          visualization={vizWithArrayColors}
          experimentId="exp-1"
          data={dataWithMultipleSeries}
        />,
      );

      const chartData = screen.getByTestId("chart-data");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed = JSON.parse(chartData.textContent ?? "{}");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(parsed[0].color).toBe("#ff0000");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(parsed[1].color).toBe("#00ff00");
    });
  });
});
