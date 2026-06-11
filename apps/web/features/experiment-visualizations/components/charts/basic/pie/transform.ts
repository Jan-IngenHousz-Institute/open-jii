import type { DataAggregation, DataSourceConfig } from "@repo/api/schemas/experiment.schema";
import type { PieSeriesData } from "@repo/ui/components/charts/pie-chart";

import type { ChartFormConfig } from "../../chart-config";
import { getCategoryColor } from "../../colors/palettes";
import { rowKeyForFunction } from "../../data/aggregation";
import { toBucketKey } from "../../data/cell-coercion";
import { dataSourcesByRole } from "../../data/data-sources";

/** Pure data transform for the pie chart. Expects rows pre-aggregated by the SQL pipeline (one row per label). */
export function transformPieData(
  rows: Record<string, unknown>[],
  dataSources: DataSourceConfig[],
  aggregation: DataAggregation | undefined,
  chartConfig: ChartFormConfig,
): PieSeriesData[] {
  const labelsColumn = dataSourcesByRole(dataSources, "labels")[0]?.source.columnName;
  const valuesColumn = dataSourcesByRole(dataSources, "values")[0]?.source.columnName;
  const aggregateFn = aggregation?.functions?.[0];
  // The SQL builder projects an aggregate function under its supplied
  // alias (or `${col || "count"}_${fn}` if absent). The hook only collapses
  // groupBy aliases back; function aliases stay verbatim, so recompute
  // here. Falls back to the raw column name when no aggregation is set.
  const valueRowKey = aggregateFn ? rowKeyForFunction(aggregateFn) : valuesColumn;
  if (!labelsColumn || !valueRowKey) {
    return [];
  }

  const labels: string[] = [];
  const values: number[] = [];
  for (const row of rows) {
    const value = Number(row[valueRowKey]);
    if (!Number.isFinite(value)) {
      continue;
    }
    labels.push(toBucketKey(row[labelsColumn]));
    values.push(value);
  }

  if (labels.length === 0) {
    return [];
  }

  // Per-slice colours from the same palette as scatter's categorical-color
  // path, so the same category reads consistently across chart types.
  const colors = labels.map((label, i) => getCategoryColor(i, chartConfig.colorMap, label));

  return [
    {
      labels,
      values,
      marker: { colors },
      hole: chartConfig.hole,
      textinfo: chartConfig.textinfo ?? "percent",
      textposition: chartConfig.pieTextPosition ?? "auto",
      sort: chartConfig.sortSlices !== false,
    },
  ];
}
