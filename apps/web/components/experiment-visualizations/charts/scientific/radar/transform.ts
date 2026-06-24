import type { DataSourceConfig } from "@repo/api/schemas/experiment.schema";
import type { RadarSeriesData } from "@repo/ui/components/charts/radar";

import type { ChartFormConfig } from "../../chart-config";
import { getCategoryColor } from "../../colors/palettes";
import { rowKeyForSource } from "../../data/aggregation";
import { coerceCell } from "../../data/cell-coercion";
import { toBucketKey } from "../../data/cell-coercion";
import { dataSourcesByRole } from "../../data/data-sources";

export interface RadarTransformResult {
  series: RadarSeriesData[];
  categories: string[];
}

/** Pure data transform for the radar chart: one polygon per row, each Y column an axis around the circle. */
export function transformRadarData(
  rows: Record<string, unknown>[],
  dataSources: DataSourceConfig[],
  chartConfig: ChartFormConfig,
): RadarTransformResult {
  const yEntries = dataSourcesByRole(dataSources, "y");
  const yPicks = yEntries
    .map((entry) => ({
      column: entry.source.columnName,
      rowKey: rowKeyForSource(entry.source, entry.index),
    }))
    .filter((p) => p.column.length > 0);

  const categories = yPicks.map((p) => p.column);

  if (yPicks.length < 3 || rows.length === 0) {
    return { series: [], categories };
  }

  const colorEntry = dataSourcesByRole(dataSources, "color").at(0);
  const colorKey = colorEntry ? rowKeyForSource(colorEntry.source, colorEntry.index) : undefined;
  // Numeric degrees; string theta collapses to angle 0 on the linear axis.
  const angleStep = 360 / categories.length;
  const thetaDegrees = categories.map((_, i) => i * angleStep);
  const thetaClosed = [...thetaDegrees, thetaDegrees[0]];

  const fill = chartConfig.radarFill !== false;
  const fillOpacity = chartConfig.radarFillOpacity ?? 0.4;
  const lineWidth = chartConfig.radarLineWidth ?? 2;
  const showMarkers = Boolean(chartConfig.radarShowMarkers);
  const mode = showMarkers ? "lines+markers" : "lines";

  const buildSeries = (
    r: number[],
    name: string,
    colorIndex: number,
    colorKey: string,
  ): RadarSeriesData => {
    const color = getCategoryColor(colorIndex, chartConfig.colorMap, colorKey);
    // `fillcolor` accepts an alpha-suffixed hex (`#rrggbbAA`); convert
    // the 0..1 slider value to a clamped byte.
    const alpha = Math.round(Math.max(0, Math.min(1, fillOpacity)) * 255)
      .toString(16)
      .padStart(2, "0");
    return {
      r: [...r, r[0]],
      theta: thetaClosed,
      name,
      color,
      mode,
      fill: fill ? "toself" : "none",
      fillcolor: fill ? `${color}${alpha}` : undefined,
      line: { color, width: lineWidth },
      marker: showMarkers ? { color, size: 6 } : undefined,
    };
  };

  // One polygon per row; when Y aggregates are set the SQL pre-groups,
  // so the same loop renders per-category polygons.
  const series = rows.map((row, i) => {
    const r = yPicks.map((p) => {
      const v = coerceCell(row[p.rowKey]);
      return typeof v === "number" ? v : NaN;
    });
    const categoryKey = colorKey ? toBucketKey(row[colorKey]) : String(i);
    const name = colorKey ? categoryKey : `Series ${i + 1}`;
    return buildSeries(r, name, i, categoryKey);
  });

  return { series, categories };
}
