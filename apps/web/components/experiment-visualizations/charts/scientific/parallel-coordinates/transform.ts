import type { ExperimentDataSourceConfig } from "@repo/api/domains/experiment/experiment.schema";
import type { ParallelCoordinatesSeriesData } from "@repo/ui/components/charts/parallel-coordinates";

import type { ChartFormConfig } from "../../chart-config";
import { resolveColorscale } from "../../colors/colorscales";
import { getCategoryColor } from "../../colors/palettes";
import { coerceCell } from "../../data/cell-coercion";
import { dataSourcesByRole } from "../../data/data-sources";

// Surfacing more than ~25 category labels on a colorbar overflows the bar
// height; stride past extras so labels stay legible.
const MAX_VISIBLE_CATEGORICAL_TICKS = 25;

interface ColorChannel {
  values: number[];
  colorscale: string | [number, string][];
  cmin: number | undefined;
  cmax: number | undefined;
  showscale: boolean;
  reverseScale: boolean;
  tickvals: number[] | undefined;
  ticktext: string[] | undefined;
}

/** Pure data transform for parallel-coordinates: builds one dimension per picked Y axis plus a per-line color array. */
export function transformParallelCoordinatesData(
  rows: Record<string, unknown>[],
  dataSources: ExperimentDataSourceConfig[],
  chartConfig: ChartFormConfig,
): { series: ParallelCoordinatesSeriesData[]; axes: string[] } {
  const yColumns = dataSourcesByRole(dataSources, "y")
    .map((entry) => entry.source.columnName)
    .filter((c): c is string => typeof c === "string" && c.length > 0);
  // Dedupe so picking the same column twice doesn't introduce a redundant axis.
  const axes = Array.from(new Set(yColumns));

  if (axes.length < 2 || rows.length === 0) {
    return { series: [], axes };
  }

  const colorColumn = dataSourcesByRole(dataSources, "color")[0]?.source.columnName;

  // One dimension per picked axis. Plotly's parcoords wants raw values
  // arrays, one per dimension, all with the same length (one entry per
  // row). Non-numeric values get coerced to NaN so the polyline shows
  // a gap rather than misaligning.
  const dimensions = axes.map((column) => ({
    label: column,
    values: rows.map((row) => {
      const v = coerceCell(row[column]);
      return typeof v === "number" ? v : NaN;
    }),
  }));

  const channel = colorColumn ? buildColorChannel(rows, colorColumn, chartConfig) : undefined;
  const colorbarTitleText = chartConfig.marker?.colorbar?.title?.text;
  const hasCustomTitle = typeof colorbarTitleText === "string" && colorbarTitleText.length > 0;

  return {
    series: [
      {
        dimensions,
        line: {
          color: channel?.values,
          colorscale: channel?.colorscale,
          reversescale: channel?.reverseScale ?? false,
          showscale: channel?.showscale ?? false,
          cmin: channel?.cmin,
          cmax: channel?.cmax,
          width: chartConfig.parcoordsLineWidth ?? 1,
          opacity: chartConfig.parcoordsLineOpacity ?? 0.5,
          colorbar: channel?.showscale
            ? {
                title: {
                  text: hasCustomTitle ? colorbarTitleText : colorColumn,
                  side: chartConfig.marker?.colorbar?.title?.side ?? "right",
                },
                ...(channel.tickvals && channel.ticktext
                  ? {
                      tickmode: "array" as const,
                      tickvals: channel.tickvals,
                      ticktext: channel.ticktext,
                    }
                  : {}),
              }
            : undefined,
        },
      },
    ],
    axes,
  };
}

function buildColorChannel(
  rows: Record<string, unknown>[],
  colorColumn: string,
  chartConfig: ChartFormConfig,
): ColorChannel {
  const rawValues = rows.map((row) => coerceCell(row[colorColumn]));
  const isCategorical = chartConfig.colorMode === "categorical";
  if (isCategorical) {
    return buildCategoricalChannel(rawValues, chartConfig);
  }
  return buildContinuousChannel(rawValues, chartConfig);
}

function buildCategoricalChannel(
  rawValues: (string | number | null)[],
  chartConfig: ChartFormConfig,
): ColorChannel {
  const categoryToIndex = new Map<string, number>();
  for (const v of rawValues) {
    const key = String(v ?? "");
    if (!categoryToIndex.has(key)) {
      categoryToIndex.set(key, categoryToIndex.size);
    }
  }
  const numCategories = categoryToIndex.size;
  const keys = [...categoryToIndex.keys()];
  const values = rawValues.map((v) => categoryToIndex.get(String(v ?? "")) ?? 0);

  // Stepwise colorscale: paired stops at i/N -> (i+1)/N with the same color
  // so value i lands inside its own band, not interpolated.
  const stops: [number, string][] = [];
  if (numCategories <= 1) {
    const color = getCategoryColor(0, chartConfig.colorMap, keys[0]);
    stops.push([0, color], [1, color]);
  } else {
    for (let i = 0; i < numCategories; i++) {
      const color = getCategoryColor(i, chartConfig.colorMap, keys[i]);
      stops.push([i / numCategories, color], [(i + 1) / numCategories, color]);
    }
  }

  // Surface category *names* on the colorbar instead of the synthesised
  // integer indices; stride past extras so labels don't overflow.
  const stride = Math.max(1, Math.ceil(numCategories / MAX_VISIBLE_CATEGORICAL_TICKS));
  const tickvals: number[] = [];
  const ticktext: string[] = [];
  for (let i = 0; i < numCategories; i += stride) {
    tickvals.push(i);
    ticktext.push(keys[i]);
  }

  return {
    values,
    colorscale: stops,
    cmin: 0,
    cmax: Math.max(numCategories - 1, 1),
    showscale: true,
    // Categorical colorscale is a synthesised step palette; reversing it
    // would scramble the value -> color mapping.
    reverseScale: false,
    tickvals,
    ticktext,
  };
}

function buildContinuousChannel(
  rawValues: (string | number | null)[],
  chartConfig: ChartFormConfig,
): ColorChannel {
  // Continuous: feed the numeric values straight to Plotly. Strings that
  // don't parse become NaN and Plotly treats them as missing.
  const values = rawValues.map((v) => (typeof v === "number" ? v : NaN));
  const raw = chartConfig.marker?.colorscale;
  const colorscale =
    typeof raw === "string" ? resolveColorscale(raw) : (raw ?? resolveColorscale("Viridis"));
  // Showscale mirrors the shelf's `showscale` toggle in continuous mode.
  const showscale = chartConfig.marker?.showscale !== false;
  return {
    values,
    colorscale,
    cmin: undefined,
    cmax: undefined,
    showscale,
    reverseScale: Boolean(chartConfig.marker?.reversescale),
    tickvals: undefined,
    ticktext: undefined,
  };
}
