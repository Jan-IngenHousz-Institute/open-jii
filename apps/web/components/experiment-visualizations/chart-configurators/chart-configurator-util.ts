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

// Helper function to get default config for chart type
export const getDefaultChartConfig = (chartType: string): ChartConfig => {
  const baseDefaults: Partial<ChartConfig> = {
    title: "",
    xAxisTitle: "",
    xAxisType: "linear",
    yAxisType: "linear",
    yAxisTitle: "",
    showLegend: true,
    showGrid: true,
    useWebGL: false,
  };

  switch (chartType) {
    case "scatter":
      return {
        ...baseDefaults,
        mode: "markers",
        marker: {
          size: 6,
          symbol: "circle",
          showscale: false,
          colorscale: "Viridis",
          colorbar: {
            title: {
              side: "right",
            },
          },
        },
      } as ChartConfig;

    case "line":
      return {
        ...baseDefaults,
        mode: "lines",
        line: {
          width: 2,
        },
        connectgaps: true,
      } as ChartConfig;

    default:
      return baseDefaults as ChartConfig;
  }
};
