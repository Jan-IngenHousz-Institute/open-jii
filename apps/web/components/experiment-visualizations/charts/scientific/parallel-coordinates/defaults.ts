import type { ChartFormConfig, ChartFormDataConfig } from "../../chart-config";
import { makeDataSource } from "../../data/data-sources";

export function parallelCoordinatesDefaultConfig(): ChartFormConfig {
  return {
    title: "",
    showLegend: false,
    showGrid: false,
    useWebGL: false,
    parcoordsLineWidth: 1,
    // Default 0.5 because parallel-coordinates commonly overplots; semi-
    // transparent lines reveal density patterns where many rows cross.
    parcoordsLineOpacity: 0.5,
    // Colorscale / colorbar live on `config.marker.*` and are seeded
    // when the user picks a color column via the Color dimension shelf.
  };
}

export function parallelCoordinatesDefaultDataConfig(tableName?: string): ChartFormDataConfig {
  const table = tableName ?? "";
  // Seed two empty Y sources so the multi-column shelf has rows to bind
  // to. Parallel-coordinates needs at least 2 columns to be meaningful.
  return {
    tableName: table,
    dataSources: [makeDataSource(table, "y"), makeDataSource(table, "y")],
  };
}
