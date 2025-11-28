import type {
  CreateExperimentVisualizationBody,
  UpdateExperimentVisualizationBody,
} from "@repo/api";
import type { PlotlyChartConfig, LineSeriesData, ScatterSeriesData } from "@repo/ui/components";

// Union type for all chart configurations
// Combines PlotlyChartConfig with series data interfaces (minus x,y data arrays)
// Add index signature to make it compatible with Record<string, unknown>
export type ChartConfig = PlotlyChartConfig &
  (Omit<LineSeriesData, "x" | "y"> | Omit<ScatterSeriesData, "x" | "y">) &
  Record<string, unknown>;

export interface ChartFormValues
  extends Omit<CreateExperimentVisualizationBody | UpdateExperimentVisualizationBody, "config"> {
  config: ChartConfig;
}

// Default color for the first series
const DEFAULT_PRIMARY_COLOR = "#3b82f6";

// Helper function to generate a random hex color
const generateRandomColor = (): string => {
  return (
    "#" +
    Math.floor(Math.random() * 0xffffff)
      .toString(16)
      .padStart(6, "0")
  );
};

export const getDefaultDataConfig = (tableName?: string): ChartFormValues["dataConfig"] => ({
  tableName: tableName ?? "",
  dataSources: [
    {
      tableName: tableName ?? "",
      columnName: "",
      role: "x",
      alias: "",
    },
    {
      tableName: tableName ?? "",
      columnName: "",
      role: "y",
      alias: "",
    },
  ],
});

// Helper function to get default config for chart type
export const getDefaultChartConfig = (chartType: string): ChartConfig => {
  const baseDefaults: Partial<ChartConfig> = {
    title: "",
    xAxisTitle: "",
    xAxisType: "linear",
    yAxisType: "linear",
    yAxisType2: "linear",
    yAxisType3: "linear",
    yAxisType4: "linear",
    yAxisTitle: "",
    yAxisTitle2: "",
    yAxisTitle3: "",
    yAxisTitle4: "",
    showLegend: true,
    showGrid: true,
    useWebGL: false,
  };

  switch (chartType) {
    case "scatter":
      return {
        ...baseDefaults,
        mode: "markers",
        color: [DEFAULT_PRIMARY_COLOR],
        marker: {
          size: 6,
          symbol: "circle",
          showscale: true,
          colorscale: "Viridis",
          colorbar: {
            title: {
              side: "right",
              text: "",
            },
          },
        },
      };

    case "line":
      return {
        ...baseDefaults,
        mode: "lines",
        color: [DEFAULT_PRIMARY_COLOR],
        line: {
          width: 2,
          smoothing: 0,
        },
        connectgaps: true,
      };

    default:
      return baseDefaults;
  }
};

// Helper function to get default color for a series by index
export const getDefaultSeriesColor = (seriesIndex: number): string => {
  // First series gets the primary color, subsequent series get random colors
  return seriesIndex === 0 ? DEFAULT_PRIMARY_COLOR : generateRandomColor();
};
