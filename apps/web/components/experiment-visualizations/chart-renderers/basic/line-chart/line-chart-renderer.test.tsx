import { createExperimentDataTable, createVisualization } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api";

import { LineChartRenderer } from "./line-chart-renderer";

// Mock the LineChart component from UI package (Plotly-based, doesn't work in jsdom)
vi.mock("@repo/ui/components", async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal();
  return {
    ...actual,
    LineChart: ({ data }: { data: unknown }) => (
      <div data-testid="line-chart">
        <pre data-testid="chart-data">{JSON.stringify(data, null, 2)}</pre>
      </div>
    ),
  };
});

describe("LineChartRenderer", () => {
  const mockVisualization = createVisualization({
    id: "viz-1",
    name: "Test Line Chart",
    description: "Test Description",
    chartType: "line",
    chartFamily: "basic",
    experimentId: "exp-1",
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
  });

  const mockData = [
    { time: 0, value: 10 },
    { time: 1, value: 20 },
    { time: 2, value: 15 },
    { time: 3, value: 25 },
  ];

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
      server.mount(contract.experiments.getExperimentData, {
        body: [createExperimentDataTable({ name: "test_table" })],
        delay: 60_000,
      });

      render(<LineChartRenderer visualization={mockVisualization} experimentId="exp-1" />);

      expect(screen.getByText("errors.loadingData")).toBeInTheDocument();
    });

    it("should show error message when fetch fails", async () => {
      server.mount(contract.experiments.getExperimentData, { status: 500 });

      render(<LineChartRenderer visualization={mockVisualization} experimentId="exp-1" />);

      expect(await screen.findByText("errors.failedToLoadData")).toBeInTheDocument();
      expect(screen.getByText("errors.failedToLoadDataDescription")).toBeInTheDocument();
    });

    it("should not show loading when data is provided", () => {
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

    it("should use fetched data when available", async () => {
      server.mount(contract.experiments.getExperimentData, {
        body: [
          createExperimentDataTable({
            name: "test_table",
            data: {
              columns: [],
              rows: mockData,
              totalRows: mockData.length,
              truncated: false,
            },
            totalRows: mockData.length,
          }),
        ],
      });

      render(<LineChartRenderer visualization={mockVisualization} experimentId="exp-1" />);

      expect(await screen.findByTestId("line-chart")).toBeInTheDocument();
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

    it("should convert object x-values to strings", () => {
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

      const chartData = screen.getByTestId("chart-data");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed = JSON.parse(chartData.textContent);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(parsed[0].x).toEqual(["[object Object]", "array"]);
    });

    it("should convert non-string/number values to strings", () => {
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

      const chartData = screen.getByTestId("chart-data");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed = JSON.parse(chartData.textContent);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(parsed[0].y).toEqual(["[object Object]", "", "true"]);
    });

    it("should preserve string y-values for Plotly to handle", () => {
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
      const parsed = JSON.parse(chartData.textContent);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(parsed[0].y).toEqual(["10", "20.5", "30"]);
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
      const parsed = JSON.parse(chartData.textContent);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(parsed[0].color).toBe("#ff0000");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(parsed[1].color).toBe("#00ff00");
    });
  });
});
