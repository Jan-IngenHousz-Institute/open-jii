import type {
  CreateExperimentVisualizationBody,
  DataSourceConfig,
  Role,
} from "@repo/api/schemas/experiment.schema";
import { getColumnKind } from "@repo/api/utils/column-type-utils";
import type { BarSeriesData } from "@repo/ui/components/charts/bar-chart";
import type { LineSeriesData } from "@repo/ui/components/charts/line-chart";
import type { ScatterSeriesData } from "@repo/ui/components/charts/scatter-chart";
import type { PlotlyChartConfig } from "@repo/ui/components/charts/types";

/**
 * Color encoding options live alongside the chart trace settings rather
 * than under `marker.*` so they stay legible regardless of the underlying
 * trace shape (a future heatmap or bar chart may want categorical colors
 * too). `colorMode` defaults to "continuous" for backward compatibility.
 */
export interface ColorEncodingOptions {
  colorMode?: "continuous" | "categorical";
  /** Optional user-authored category → hex overrides. */
  colorMap?: Record<string, string>;
}

/**
 * Bar-chart-only options. Orientation, sort, and top-N are presentation
 * concerns (the bar renderer applies them on the client). The aggregation
 * function lives here too — the renderer aggregates rows client-side, so
 * the function is a render hint rather than a data-shape decision, and
 * keeping it next to the other bar options keeps the data panel's
 * setValue calls confined to one path.
 *
 * `xColumnType` is captured by the data panel when the user picks the X
 * column, so the renderer can detect CONTRIBUTOR struct cells without
 * re-fetching column metadata. Empty string when no column is picked.
 */
export interface BarChartOptions {
  orientation?: "v" | "h";
  sortDirection?: "asc" | "desc" | null;
  topN?: number;
  aggregationFunction?: "count" | "sum" | "avg" | "min" | "max";
  xColumnType?: string;
  /**
   * Only meaningful when `xColumnType` is the QUESTIONS well-known array;
   * picks which entry's `question_answer` to use as the group key.
   */
  questionLabel?: string;
}

export type ChartFormConfig = PlotlyChartConfig &
  Partial<Omit<LineSeriesData, "x" | "y">> &
  Partial<Omit<ScatterSeriesData, "x" | "y">> &
  Partial<Omit<BarSeriesData, "x" | "y" | "orientation">> &
  BarChartOptions &
  ColorEncodingOptions;

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

export const DEFAULT_PRIMARY_COLOR = "#3b82f6";

// Deterministic palette so adding a series doesn't produce non-reproducible
// autosave bodies (random hex per render → meaningless config diffs in git
// history and unstable tests). Colors are picked to be visually distinct
// across the first few series; beyond palette length we wrap.
const SERIES_PALETTE = [
  DEFAULT_PRIMARY_COLOR,
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#84cc16",
] as const;

export function getDefaultSeriesColor(seriesIndex: number): string {
  return SERIES_PALETTE[seriesIndex % SERIES_PALETTE.length];
}

/**
 * Categorical color palette for "color by category" encoding. D3
 * schemeCategory10 + 10 lighter alternates so legibility holds for ~20
 * categories without hand-picked overrides; beyond that the palette wraps.
 * Users can override per-category via `config.colorMap`.
 */
export const CATEGORY_PALETTE = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
  "#bcbd22",
  "#17becf",
  "#aec7e8",
  "#ffbb78",
  "#98df8a",
  "#ff9896",
  "#c5b0d5",
  "#c49c94",
  "#f7b6d2",
  "#c7c7c7",
  "#dbdb8d",
  "#9edae5",
] as const;

export function getCategoryColor(index: number, colorMap?: Record<string, string>, key?: string) {
  if (key && colorMap?.[key]) return colorMap[key];
  return CATEGORY_PALETTE[index % CATEGORY_PALETTE.length];
}

export type AxisType = "linear" | "log" | "date" | "category" | "multicategory";

/**
 * Map a column's database type to the Plotly axis type that fits its data.
 * Used to auto-pick the right axis type when a user selects a column for X
 * or Y so they don't see "linear" forced on a string column. Returns
 * "linear" as the safe default for numeric/decimal/unknown kinds — other
 * scales (log) are an explicit user override, not a default.
 */
export function defaultAxisTypeFor(typeText: string | undefined): AxisType {
  const kind = getColumnKind(typeText);
  if (kind === "temporal") return "date";
  if (kind === "categorical") return "category";
  return "linear";
}
