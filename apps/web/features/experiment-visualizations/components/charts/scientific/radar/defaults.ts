import type { ChartFormConfig, ChartFormDataConfig } from "../../chart-config";
import { makeDataSource } from "../../data/data-sources";

export function radarDefaultConfig(): ChartFormConfig {
  return {
    title: "",
    showLegend: true,
    showGrid: true,
    useWebGL: false,
    radarFill: true,
    // 0.4 lets overlapping polygons read clearly without the front one
    // fully hiding those behind it.
    radarFillOpacity: 0.4,
    radarLineWidth: 2,
    radarShowMarkers: false,
  };
}

export function radarDefaultDataConfig(tableName?: string): ChartFormDataConfig {
  const table = tableName ?? "";
  // Seed three Y sources with `avg`: typical experiment tables are
  // long-form, so one polygon per row would be unreadable. With `avg`
  // seeded the SQL collapses to one row (or per-category when a color
  // column is added). Wide-form datasets clear the aggregate per series.
  const y1 = makeDataSource(table, "y");
  const y2 = makeDataSource(table, "y");
  const y3 = makeDataSource(table, "y");
  y1.aggregate = "avg";
  y2.aggregate = "avg";
  y3.aggregate = "avg";
  return {
    tableName: table,
    dataSources: [y1, y2, y3],
  };
}
