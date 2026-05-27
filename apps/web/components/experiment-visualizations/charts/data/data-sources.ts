import type { DataSourceConfig, Role } from "@repo/api/schemas/experiment.schema";

import type { ChartFormDataConfig } from "../chart-config";

export interface IndexedDataSource {
  source: DataSourceConfig;
  index: number;
}

export function dataSourcesByRole(
  sources: ChartFormDataConfig["dataSources"],
  role: Role,
): IndexedDataSource[] {
  return sources
    .map((source, index) => ({ source, index }))
    .filter(({ source }) => source.role === role);
}

export function firstDataSourceByRole(
  sources: ChartFormDataConfig["dataSources"],
  role: Role,
): IndexedDataSource | undefined {
  return dataSourcesByRole(sources, role)[0];
}

export function makeDataSource(tableName: string, role: Role): DataSourceConfig {
  return { tableName, columnName: "", role, alias: "" };
}
