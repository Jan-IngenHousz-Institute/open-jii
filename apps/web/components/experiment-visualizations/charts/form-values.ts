import type {
  CreateExperimentVisualizationBody,
  DataSourceConfig,
} from "@repo/api/schemas/experiment.schema";
import type { LineSeriesData } from "@repo/ui/components/charts/line-chart";
import type { ScatterSeriesData } from "@repo/ui/components/charts/scatter-chart";
import type { PlotlyChartConfig } from "@repo/ui/components/charts/types";

export type ChartFormConfig = PlotlyChartConfig &
  Partial<Omit<LineSeriesData, "x" | "y">> &
  Partial<Omit<ScatterSeriesData, "x" | "y">>;

export type ChartFormDataConfig = CreateExperimentVisualizationBody["dataConfig"];

export interface ChartFormValues extends Omit<CreateExperimentVisualizationBody, "config"> {
  config: ChartFormConfig;
}

export interface IndexedDataSource {
  source: DataSourceConfig;
  index: number;
}

export function dataSourcesByRole(
  sources: ChartFormDataConfig["dataSources"],
  role: string,
): IndexedDataSource[] {
  return sources
    .map((source, index) => ({ source, index }))
    .filter(({ source }) => source.role === role);
}

export function firstDataSourceByRole(
  sources: ChartFormDataConfig["dataSources"],
  role: string,
): IndexedDataSource | undefined {
  return dataSourcesByRole(sources, role)[0];
}

export function makeDataSource(tableName: string, role: string): DataSourceConfig {
  return { tableName, columnName: "", role, alias: "" };
}

export const DEFAULT_PRIMARY_COLOR = "#3b82f6";

export function generateRandomColor(): string {
  return (
    "#" +
    Math.floor(Math.random() * 0xffffff)
      .toString(16)
      .padStart(6, "0")
  );
}

export function getDefaultSeriesColor(seriesIndex: number): string {
  return seriesIndex === 0 ? DEFAULT_PRIMARY_COLOR : generateRandomColor();
}
