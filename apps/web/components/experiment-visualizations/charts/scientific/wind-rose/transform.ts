import type { ExperimentDataSourceConfig } from "@repo/api/domains/experiment/experiment.schema";
import type { WindRoseSeriesData } from "@repo/ui/components/charts/wind-rose";

import type { ChartFormConfig } from "../../chart-config";
import { colorscaleStops } from "../../colors/colorscales";
import { coerceCell } from "../../data/cell-coercion";
import { dataSourcesByRole } from "../../data/data-sources";

const FALLBACK_BIN_COLOR = "#888";

export interface WindRoseTransformResult {
  series: WindRoseSeriesData[];
  hasData: boolean;
}

const DEFAULT_LABELS_8 = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const DEFAULT_LABELS_16 = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
];

/** Default direction-tick labels for 8 / 16 / 32 bins. The 32-bin case shows degree ticks on every other slice for legibility. */
export function defaultLabelsFor(bins: number): string[] {
  if (bins === 8) {
    return DEFAULT_LABELS_8;
  }
  if (bins === 16) {
    return DEFAULT_LABELS_16;
  }
  return Array.from({ length: 32 }, (_, i) => (i % 2 === 0 ? `${i * (360 / 32)}°` : ""));
}

/** Sample N visually-distinct colors from a named colorscale. */
function sampleColorscale(name: string, count: number, reverse: boolean): string[] {
  const stops = colorscaleStops(name);
  if (stops.length === 0) {
    return Array.from({ length: count }, () => FALLBACK_BIN_COLOR);
  }
  const ordered = reverse ? [...stops].reverse() : stops;
  if (count <= 1) {
    return [ordered[Math.floor(ordered.length / 2)] ?? ordered[0]];
  }
  // Snap to the nearest stop rather than RGB-interpolating.
  const sampled: string[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.round((i / (count - 1)) * (ordered.length - 1));
    sampled.push(ordered[idx]);
  }
  return sampled;
}

function binMagnitudes(
  values: number[],
  binCount: number,
): { binIndex: number[]; bounds: [number, number][] } {
  if (values.length === 0) {
    return { binIndex: [], bounds: [] };
  }
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (Number.isFinite(v)) {
      if (v < min) {
        min = v;
      }
      if (v > max) {
        max = v;
      }
    }
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    // One bounds entry per value bin so degenerate traces don't legend as "0–0".
    return {
      binIndex: values.map(() => 0),
      bounds: Array.from({ length: binCount }, () => [min, max] as [number, number]),
    };
  }
  const width = (max - min) / binCount;
  const binIndex = values.map((v) => {
    if (!Number.isFinite(v)) {
      return -1;
    }
    const idx = Math.floor((v - min) / width);
    return Math.min(idx, binCount - 1);
  });
  const bounds: [number, number][] = [];
  for (let i = 0; i < binCount; i++) {
    bounds.push([min + i * width, min + (i + 1) * width]);
  }
  return { binIndex, bounds };
}

function formatRange(low: number, high: number): string {
  const fmt = (n: number) =>
    Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(2).replace(/\.?0+$/, "");
  return `${fmt(low)}–${fmt(high)}`;
}

/** Pure data transform for the wind-rose chart: bins (direction, magnitude) into a (direction x value) matrix and emits one barpolar trace per value band. */
export function transformWindRoseData(
  rows: Record<string, unknown>[],
  dataSources: ExperimentDataSourceConfig[],
  chartConfig: ChartFormConfig,
): WindRoseTransformResult {
  const xColumn = dataSourcesByRole(dataSources, "x")[0]?.source.columnName;
  const yColumn = dataSourcesByRole(dataSources, "y")[0]?.source.columnName;
  if (!xColumn || !yColumn || rows.length === 0) {
    return { series: [], hasData: false };
  }

  const directionBins = chartConfig.windRoseDirectionBins ?? 8;
  const valueBins = chartConfig.windRoseValueBins ?? 5;
  const colorscale = chartConfig.windRoseColorscale ?? "Viridis";
  const reverseScale = Boolean(chartConfig.windRoseReverseScale);

  const dirs: number[] = [];
  const mags: number[] = [];
  for (const row of rows) {
    const d = coerceCell(row[xColumn]);
    const m = coerceCell(row[yColumn]);
    if (
      typeof d !== "number" ||
      typeof m !== "number" ||
      !Number.isFinite(d) ||
      !Number.isFinite(m)
    ) {
      continue;
    }
    const normalized = ((d % 360) + 360) % 360;
    dirs.push(normalized);
    mags.push(m);
  }
  if (dirs.length === 0) {
    return { series: [], hasData: false };
  }

  const sliceWidth = 360 / directionBins;
  const directionIndex = dirs.map((d) => Math.min(Math.floor(d / sliceWidth), directionBins - 1));

  const { binIndex: magBin, bounds } = binMagnitudes(mags, valueBins);

  // Count rows per (direction-bin, value-bin). 2D matrix: counts[v][d].
  const counts: number[][] = Array.from({ length: valueBins }, () =>
    Array.from({ length: directionBins }, () => 0),
  );
  for (let i = 0; i < dirs.length; i++) {
    const v = magBin[i];
    const d = directionIndex[i];
    if (v < 0 || v >= valueBins) {
      continue;
    }
    counts[v][d] += 1;
  }

  // Bin centres on the angular axis. With compass orientation (rotation:
  // 90 + clockwise) the wrapper renders 0deg at the top.
  const thetaCenters = Array.from(
    { length: directionBins },
    (_, i) => i * sliceWidth + sliceWidth / 2,
  );

  // One barpolar trace per value band in ascending order so the legend
  // reads low to high. Plotly stacks via `barmode: "stack"`.
  const colors = sampleColorscale(colorscale, valueBins, reverseScale);
  const series: WindRoseSeriesData[] = [];
  for (let v = 0; v < valueBins; v++) {
    const [low, high] = bounds[v] ?? [0, 0];
    series.push({
      name: formatRange(low, high),
      r: counts[v],
      theta: thetaCenters,
      width: sliceWidth,
      color: colors[v],
      marker: { color: colors[v] },
    });
  }
  return { series, hasData: true };
}
