import type {
  ExperimentDataSourceConfig,
  ExperimentRole,
} from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";

import type { ChartFormDataConfig } from "../chart-config";

export interface IndexedDataSource {
  source: ExperimentDataSourceConfig;
  index: number;
}

export function dataSourcesByRole(
  sources: ChartFormDataConfig["dataSources"],
  role: ExperimentRole,
): IndexedDataSource[] {
  return sources
    .map((source, index) => ({ source, index }))
    .filter(({ source }) => source.role === role);
}

export function firstDataSourceByRole(
  sources: ChartFormDataConfig["dataSources"],
  role: ExperimentRole,
): IndexedDataSource | undefined {
  return dataSourcesByRole(sources, role)[0];
}

export function makeDataSource(
  tableName: string,
  role: ExperimentRole,
): ExperimentDataSourceConfig {
  return { tableName, columnName: "", role, alias: "" };
}
