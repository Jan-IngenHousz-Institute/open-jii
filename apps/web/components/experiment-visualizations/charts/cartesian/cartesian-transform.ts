import type { DataSourceConfig, SeriesTraceType } from "@repo/api/schemas/experiment.schema";
import type { CartesianSeries } from "@repo/ui/components/charts/cartesian-chart";
import type { FacetGridConfig } from "@repo/ui/components/charts/cartesian-chart";
import type { MarkerConfig } from "@repo/ui/components/charts/types";
import { defaultFacetColumns } from "@repo/ui/components/charts/utils";

import type { ChartFormConfig } from "../chart-config";
import { getCategoryColor, withAlpha } from "../colors/palettes";
import { aggregateAliasForSource } from "../data/aggregation";
import { coerceCell, toBucketKey } from "../data/cell-coercion";
import type { IndexedDataSource } from "../data/data-sources";
import { dataSourcesByRole } from "../data/data-sources";

export interface CartesianTransformOptions {
  defaultTraceType: SeriesTraceType;
  /** Allow per-point continuous color (scatter / bubble). */
  supportsContinuousColor: boolean;
  /** Allow a `role: "size"` data source to drive bubble sizes. */
  supportsSize: boolean;
}

export interface CartesianTransformResult {
  chartSeries: CartesianSeries[];
  subplots: FacetGridConfig | undefined;
  /**
   * Whether X was synthesised from row index (no X column picked yet).
   * The renderer needs this to override `xAxisType` to `"linear"` so the
   * synthetic indices don't render against a date/category axis.
   */
  useIndexForX: boolean;
}

/**
 * Pure data transform for the shared cartesian renderer (line / scatter
 * / bar / area / bubble / spc / error-bar). Reads `dataSources` to
 * resolve role columns, walks `rows` to bucket / pivot per Y series,
 * facet cell, and (when categorical) color category, then emits the
 * `CartesianSeries[]` the wrapper consumes.
 *
 * Lives outside the renderer so the data-shaping code is testable in
 * isolation and the renderer is left to React orchestration only.
 */
export function transformCartesianData(
  rows: Record<string, unknown>[],
  dataSources: DataSourceConfig[],
  chartConfig: ChartFormConfig,
  options: CartesianTransformOptions,
): CartesianTransformResult {
  const { defaultTraceType, supportsContinuousColor, supportsSize } = options;
  const xColumn = dataSourcesByRole(dataSources, "x")[0]?.source.columnName;
  const yEntries = dataSourcesByRole(dataSources, "y");
  const colorColumn = dataSourcesByRole(dataSources, "color")[0]?.source.columnName;
  const facetColumn = dataSourcesByRole(dataSources, "facet")[0]?.source.columnName;

  const { effectiveYEntries, useIndexForX } = resolveSeries(yEntries, xColumn);

  if (effectiveYEntries.length === 0) {
    return { chartSeries: [], subplots: undefined, useIndexForX };
  }

  const isCategoricalColor = Boolean(colorColumn) && chartConfig.colorMode === "categorical";
  const isContinuousColor = supportsContinuousColor && Boolean(colorColumn) && !isCategoricalColor;

  // Each data source's row-key for reading values: when the source has
  // its own `aggregate`, the SQL projects it under a unique alias
  // (`aggregateAliasForSource`) so two series on the same column with
  // different aggregates land in separate columns. Without an aggregate
  // the source's column name is the row key directly.
  const rowKeyFor = (source: { columnName: string }, dsIndex: number): string => {
    const ds = dataSources[dsIndex];
    if (ds.aggregate) {
      return aggregateAliasForSource(ds.columnName, ds.aggregate, dsIndex);
    }
    return source.columnName;
  };

  const colorMap = chartConfig.colorMap;

  // Pre-compute size-encoding values once across ALL rows (not per
  // facet cell) so every cell shares the same `sizeref` and bubbles
  // stay comparable across cells.
  const sizeSource = dataSourcesByRole(dataSources, "size").at(0);
  const sizeRowKey = sizeSource ? rowKeyFor(sizeSource.source, sizeSource.index) : undefined;
  const sizeCtx =
    supportsSize && rows.length > 0 ? buildSizeContext(rows, sizeRowKey, chartConfig) : null;

  // Categorical color: compute the global category list across all
  // rows so each facet cell uses the same palette mapping. Without
  // this, "device A" might get green in cell 1 and orange in cell 2,
  // breaking the legend's promise that one category = one colour.
  const globalCategoryKeys: string[] = [];
  const globalCategoryLabels: (string | number | null)[] = [];
  if (isCategoricalColor && colorColumn) {
    const seen = new Set<string>();
    const pending: { key: string; label: string | number | null }[] = [];
    for (const row of rows) {
      const raw = row[colorColumn];
      const key = toBucketKey(raw);
      if (seen.has(key)) continue;
      seen.add(key);
      pending.push({ key, label: raw == null ? null : (raw as string | number) });
    }
    // Sort alphabetically so palette indices match the picker's swatch order.
    pending.sort((a, b) => a.key.localeCompare(b.key));
    for (const { key, label } of pending) {
      globalCategoryKeys.push(key);
      globalCategoryLabels.push(label);
    }
  }

  // Group rows by facet column. When unfaceted, single group keyed by
  // empty string holds all rows and the cell's axis IDs default to
  // Plotly's implicit "x" / "y" pair (no subplot routing).
  const facetGroups: { key: string; label: string; rows: Record<string, unknown>[] }[] = [];
  if (facetColumn) {
    const groupMap = new Map<string, Record<string, unknown>[]>();
    for (const row of rows) {
      const key = toBucketKey(row[facetColumn]);
      const bucket = groupMap.get(key);
      if (bucket) {
        bucket.push(row);
      } else {
        groupMap.set(key, [row]);
      }
    }
    for (const [key, groupRows] of groupMap) {
      facetGroups.push({ key, label: key === "" ? "(none)" : key, rows: groupRows });
    }
  } else {
    facetGroups.push({ key: "", label: "", rows });
  }

  // No facets → emit a single group. Faceted → one cell per group with
  // numbered axis IDs ("x", "x2", "x3", ...).
  const buildAxisIds = (
    cellIndex: number,
  ): { xaxisId: string | undefined; yaxisId: string | undefined } => {
    if (!facetColumn) {
      return { xaxisId: undefined, yaxisId: undefined };
    }
    const suffix = cellIndex === 0 ? "" : String(cellIndex + 1);
    return { xaxisId: `x${suffix}`, yaxisId: `y${suffix}` };
  };

  // Secondary-axis Y series in facet mode need their own overlay y-axis per
  // cell. The grid uses primary indices 1..N (y, y2, ..., yN); secondary
  // overlays live above that range (y[N+cell+1]) so they never collide.
  const totalCells = facetGroups.length;
  const hasSecondaryAxis = effectiveYEntries.some(
    ({ source }, seriesOrdinal) => seriesOrdinal !== 0 && source.axis === "secondary",
  );
  const secondaryYaxisIdFor = (cellIndex: number): string | undefined =>
    facetColumn && hasSecondaryAxis ? `y${totalCells + cellIndex + 1}` : undefined;

  // Pick the per-series fallback color from the chart-level `color` prop:
  // either a single value or one-per-series array.
  const pickFallbackColor = (seriesOrdinal: number): string | undefined =>
    Array.isArray(chartConfig.color) ? chartConfig.color[seriesOrdinal] : chartConfig.color;

  // Continuous color: one trace per Y series, per-point colorscale.
  const buildContinuousColorCellSeries = (
    cellRows: Record<string, unknown>[],
    cellIndex: number,
    xaxisId: string | undefined,
    yaxisId: string | undefined,
    showlegend: boolean | undefined,
  ): CartesianSeries[] => {
    if (!colorColumn) {
      return [];
    }
    // X and color values are shared across every Y series in this cell.
    const x = buildXValues(cellRows, xColumn, useIndexForX);
    const colorValues = cellRows.map((row) => Number(row[colorColumn]));
    return effectiveYEntries.map(({ source, index: dsIndex }, seriesOrdinal): CartesianSeries => {
      const yKey = rowKeyFor(source, dsIndex);
      const y = cellRows.map((row) => coerceCell(row[yKey]));
      const errorValues = readErrorValues(cellRows, source.errorColumn);
      const series = buildSeries({
        chartConfig,
        source,
        defaultTraceType,
        seriesOrdinal,
        fallbackColor: pickFallbackColor(seriesOrdinal),
        continuousColorValues: colorValues,
        sizeContext: sizeCtx,
        name: source.alias ?? source.columnName,
        x,
        y,
        errorValues,
      });
      // Hide colorbar on cells past the first to dedupe the legend
      // and prevent N stacked colorbars in the right gutter.
      const marker =
        cellIndex > 0 && series.marker ? { ...series.marker, showscale: false } : series.marker;
      return { ...series, marker, xaxisId, yaxisId, showlegend };
    });
  };

  // No color column: one trace per Y series.
  const buildPlainCellSeries = (
    cellRows: Record<string, unknown>[],
    xaxisId: string | undefined,
    yaxisId: string | undefined,
    showlegend: boolean | undefined,
  ): CartesianSeries[] => {
    const x = buildXValues(cellRows, xColumn, useIndexForX);
    return effectiveYEntries.map(({ source, index: dsIndex }, seriesOrdinal): CartesianSeries => {
      const yKey = rowKeyFor(source, dsIndex);
      const y = cellRows.map((row) => coerceCell(row[yKey]));
      const errorValues = readErrorValues(cellRows, source.errorColumn);
      const series = buildSeries({
        chartConfig,
        source,
        defaultTraceType,
        seriesOrdinal,
        fallbackColor: pickFallbackColor(seriesOrdinal),
        sizeContext: sizeCtx,
        name: source.alias ?? source.columnName,
        x,
        y,
        errorValues,
      });
      return { ...series, xaxisId, yaxisId, showlegend };
    });
  };

  // Categorical color split: bucket this cell's rows by the global category
  // list so colours map consistently across cells, then emit one trace per
  // (Y × category).
  const buildCategoricalColorCellSeries = (
    cellRows: Record<string, unknown>[],
    xaxisId: string | undefined,
    yaxisId: string | undefined,
    showlegend: boolean | undefined,
  ): CartesianSeries[] => {
    if (!colorColumn) {
      return [];
    }
    const cellByCategory = new Map<
      string,
      { rows: Record<string, unknown>[]; indices: number[] }
    >();
    for (let i = 0; i < cellRows.length; i++) {
      const key = toBucketKey(cellRows[i][colorColumn]);
      const bucket = cellByCategory.get(key);
      if (bucket) {
        bucket.rows.push(cellRows[i]);
        bucket.indices.push(i);
      } else {
        cellByCategory.set(key, { rows: [cellRows[i]], indices: [i] });
      }
    }

    // X and (when sized) per-category size context are shared across every
    // Y series; pre-compute once per category here so the (Y × category)
    // inner loop is just per-Y work (y values + errors).
    const xByCategory = new Map<string, ReturnType<typeof buildXValues>>();
    const sizeContextByCategory = sizeCtx?.values ? new Map<string, SizeContext>() : null;
    for (const [key, bucket] of cellByCategory) {
      xByCategory.set(key, buildXValues(bucket.rows, xColumn, useIndexForX));
      if (sizeContextByCategory && sizeCtx?.values) {
        const sizeValues = sizeCtx.values;
        const sliced = bucket.indices.map((idx) => sizeValues[idx]);
        sizeContextByCategory.set(key, { ...sizeCtx, values: sliced });
      }
    }

    // Stacked area pairs values by index, not by x. Share the x grid
    // across categories and zero-fill missing slots.
    const needsSharedXGrid =
      defaultTraceType === "area" &&
      chartConfig.stackMode !== undefined &&
      chartConfig.stackMode !== "none";
    const sharedX = needsSharedXGrid ? buildUnionXGrid(cellByCategory, xColumn) : null;

    return effectiveYEntries.flatMap(({ source, index: dsIndex }, seriesOrdinal) => {
      const baseName = source.alias ?? source.columnName;
      const yKey = rowKeyFor(source, dsIndex);
      return globalCategoryLabels.map((categoryValue, catIndex): CartesianSeries => {
        const key = globalCategoryKeys[catIndex];
        const groupRows = cellByCategory.get(key)?.rows ?? [];
        const categoryLabel = categoryValue == null ? "(none)" : String(categoryValue);
        const traceName =
          effectiveYEntries.length === 1 ? categoryLabel : `${baseName} — ${categoryLabel}`;
        const x = sharedX ?? xByCategory.get(key) ?? [];
        const y = sharedX
          ? alignYToSharedX(groupRows, xColumn, yKey, sharedX)
          : groupRows.map((row: Record<string, unknown>) => coerceCell(row[yKey]));
        const errorValues = readErrorValues(groupRows, source.errorColumn);
        const sizeContextForGroup = sizeContextByCategory?.get(key) ?? sizeCtx;
        const series = buildSeries({
          chartConfig,
          source,
          defaultTraceType,
          seriesOrdinal,
          fallbackColor: getCategoryColor(
            catIndex + seriesOrdinal * globalCategoryLabels.length,
            colorMap,
            key,
            baseName,
          ),
          sizeContext: sizeContextForGroup,
          // Group per (series × category) so each combo gets its own legend
          // entry and toggles together across facet cells. Keying on the
          // series alone collapsed every category into one legend row.
          legendgroup: effectiveYEntries.length > 1 ? traceName : undefined,
          name: traceName,
          x,
          y,
          errorValues,
        });
        return { ...series, xaxisId, yaxisId, showlegend };
      });
    });
  };

  const buildSeriesForCell = (
    cellRows: Record<string, unknown>[],
    cellIndex: number,
  ): CartesianSeries[] => {
    const { xaxisId, yaxisId } = buildAxisIds(cellIndex);
    const cellSeries =
      isContinuousColor && colorColumn
        ? buildContinuousColorCellSeries(
            cellRows,
            cellIndex,
            xaxisId,
            yaxisId,
            cellIndex === 0 ? undefined : false,
          )
        : !colorColumn
          ? buildPlainCellSeries(cellRows, xaxisId, yaxisId, undefined)
          : buildCategoricalColorCellSeries(cellRows, xaxisId, yaxisId, undefined);

    // Route this cell's secondary-axis traces onto the cell's overlay axis;
    // the builders above pinned every trace to the primary yaxis.
    const secondaryYaxisId = secondaryYaxisIdFor(cellIndex);
    if (!secondaryYaxisId) {
      return cellSeries;
    }
    return cellSeries.map((s) =>
      s.axis === "secondary" ? { ...s, yaxisId: secondaryYaxisId } : s,
    );
  };

  const allSeries: CartesianSeries[] = [];
  for (let i = 0; i < facetGroups.length; i++) {
    allSeries.push(...buildSeriesForCell(facetGroups[i].rows, i));
  }

  // Show each (legendgroup ?? name) once -- from the first cell with data.
  const seenLegendKeys = new Set<string>();
  for (let i = 0; i < allSeries.length; i++) {
    const trace = allSeries[i];
    const hasData = trace.y.length > 0 && trace.y.some((v) => v !== null);
    const key = trace.legendgroup ?? trace.name ?? "";
    if (!hasData || seenLegendKeys.has(key)) {
      allSeries[i] = { ...trace, showlegend: false };
      continue;
    }
    seenLegendKeys.add(key);
  }

  // Plotly's stackgroup only works on linear/log axes; cumulate the y
  // values ourselves so date and category axes stack the same way.
  const stackedSeries = applyManualStacking(allSeries, chartConfig.stackMode);

  if (!facetColumn) {
    return { chartSeries: stackedSeries, subplots: undefined, useIndexForX };
  }

  // Build the grid spec. `facetColumns` overrides the auto default;
  // `rows` is computed from total cells / columns, ceiling.
  const requestedColumns = chartConfig.facetColumns;
  const cols =
    typeof requestedColumns === "number" && requestedColumns > 0
      ? Math.min(totalCells, Math.floor(requestedColumns))
      : defaultFacetColumns(totalCells);
  const gridRows = Math.ceil(totalCells / cols);
  const cells: FacetGridConfig["cells"] = facetGroups.map((group, i) => {
    const suffix = i === 0 ? "" : String(i + 1);
    return {
      title: group.label,
      xaxisId: `x${suffix}`,
      yaxisId: `y${suffix}`,
      secondaryYaxisId: hasSecondaryAxis ? `y${totalCells + i + 1}` : undefined,
    };
  });

  const subplotsConfig: FacetGridConfig = {
    rows: gridRows,
    columns: cols,
    cells,
    sharedX: chartConfig.facetSharedX !== false,
    sharedY: chartConfig.facetSharedY !== false,
    sharedXTitle: chartConfig.facetSharedXTitle !== false,
    sharedYTitle: chartConfig.facetSharedYTitle !== false,
    roworder: chartConfig.facetRowOrder === "bottom-to-top" ? "bottom to top" : "top to bottom",
  };

  return { chartSeries: stackedSeries, subplots: subplotsConfig, useIndexForX };
}

/** Cumulate y values per stackgroup so date/category x-axes stack the
 *  same way Plotly's stackgroup would on linear/log. Percent mode
 *  normalizes by the per-x total before cumulating. */
function applyManualStacking(
  series: CartesianSeries[],
  stackMode: ChartFormConfig["stackMode"],
): CartesianSeries[] {
  if (stackMode === undefined || stackMode === "none") return series;
  const groups = new Map<string, number[]>();
  for (let i = 0; i < series.length; i++) {
    const sg = series[i]?.stackgroup;
    if (!sg) continue;
    const list = groups.get(sg) ?? [];
    list.push(i);
    groups.set(sg, list);
  }
  if (groups.size === 0) return series;

  const result = [...series];
  for (const indices of groups.values()) {
    const first = result[indices[0]];
    const xLen = Array.isArray(first.y) ? first.y.length : 0;
    if (xLen === 0) continue;

    const totals = new Array<number>(xLen).fill(0);
    if (stackMode === "percent") {
      for (const idx of indices) {
        const trace = result[idx];
        for (let xi = 0; xi < xLen; xi++) {
          const v = Number(trace.y[xi]);
          if (Number.isFinite(v)) totals[xi] += v;
        }
      }
    }

    const cumulative = new Array<number>(xLen).fill(0);
    for (let pos = 0; pos < indices.length; pos++) {
      const idx = indices[pos];
      const trace = result[idx];
      const newY: number[] = [];
      for (let xi = 0; xi < xLen; xi++) {
        let v = Number(trace.y[xi]);
        if (!Number.isFinite(v)) v = 0;
        if (stackMode === "percent") {
          const total = totals[xi] ?? 0;
          v = total > 0 ? (v / total) * 100 : 0;
        }
        cumulative[xi] = (cumulative[xi] ?? 0) + v;
        newY.push(cumulative[xi] ?? 0);
      }
      // Bottom trace fills to y=0; the rest fill down to the trace below.
      const fill = pos === 0 ? "tozeroy" : "tonexty";
      result[idx] = { ...trace, y: newY, stackgroup: undefined, fill };
    }
  }
  return result;
}

interface SizeContext {
  values: number[] | undefined;
  fallbackSize: number;
  sizemode: "area" | "diameter";
  sizeref: number;
  sizemin: number;
}

interface BuildSeriesArgs {
  chartConfig: ChartFormConfig;
  source: {
    columnName: string;
    alias?: string;
    traceType?: SeriesTraceType;
    axis?: "primary" | "secondary";
  };
  errorValues?: number[];
  defaultTraceType: SeriesTraceType;
  seriesOrdinal: number;
  fallbackColor: string | undefined;
  continuousColorValues?: number[];
  sizeContext?: SizeContext | null;
  legendgroup?: string;
  name: string;
  x: (string | number | null)[];
  y: (string | number | null)[];
}

function resolveSeries(
  yEntries: IndexedDataSource[],
  xColumn: string | undefined,
): { effectiveYEntries: IndexedDataSource[]; useIndexForX: boolean } {
  return {
    effectiveYEntries: yEntries,
    useIndexForX: yEntries.length > 0 && !xColumn,
  };
}

const LINE_MODES = new Set<CartesianSeries["mode"]>(["lines", "lines+markers", "none"]);
const SCATTER_MODES = new Set<CartesianSeries["mode"]>(["markers", "lines+markers", "none"]);

// Reconcile the user's chosen `mode` with what each trace type can render:
// line traces drop "markers"-only, scatter drops "lines"-only. Falls back
// to the type's natural default when the user's mode doesn't fit.
function resolveSeriesMode(
  traceType: SeriesTraceType,
  rawMode: ChartFormConfig["mode"],
): CartesianSeries["mode"] | undefined {
  const userMode = typeof rawMode === "string" ? (rawMode as CartesianSeries["mode"]) : undefined;
  if (traceType === "line") {
    return userMode && LINE_MODES.has(userMode) ? userMode : "lines";
  }
  if (traceType === "scatter") {
    return userMode && SCATTER_MODES.has(userMode) ? userMode : "markers";
  }
  return undefined;
}

function buildXValues(
  rows: Record<string, unknown>[],
  xColumn: string | undefined,
  useIndexForX: boolean,
): (string | number | null)[] {
  if (useIndexForX || !xColumn) {
    return rows.map((_row, i) => i);
  }
  return rows.map((row) => coerceCell(row[xColumn]));
}

/** Union of x values across all category buckets, sorted ascending. Numeric
 *  if every value is numeric (ISO dates sort correctly lexically). */
function buildUnionXGrid(
  cellByCategory: Map<string, { rows: Record<string, unknown>[]; indices: number[] }>,
  xColumn: string | undefined,
): (string | number)[] {
  if (!xColumn) return [];
  const seen = new Map<string, string | number>();
  for (const { rows } of cellByCategory.values()) {
    for (const row of rows) {
      const xv = coerceCell(row[xColumn]);
      if (xv === null) continue;
      const key = String(xv);
      if (!seen.has(key)) seen.set(key, xv);
    }
  }
  const all = Array.from(seen.values());
  const allNumeric = all.every((v) => typeof v === "number");
  all.sort((a, b) =>
    allNumeric ? (a as number) - (b as number) : String(a).localeCompare(String(b)),
  );
  return all;
}

/** Map a category's rows onto the shared x grid, filling missing slots with
 *  `0` so stacked area traces line up. Treats absence as zero contribution
 *  to the stack — the typical stacked-area expectation. */
function alignYToSharedX(
  rows: Record<string, unknown>[],
  xColumn: string | undefined,
  yKey: string,
  sharedX: (string | number)[],
): (string | number | null)[] {
  if (!xColumn) {
    return sharedX.map((_, i) => coerceCell(rows[i]?.[yKey]) ?? 0);
  }
  const yByXKey = new Map<string, string | number | null>();
  for (const row of rows) {
    const xv = coerceCell(row[xColumn]);
    if (xv === null) continue;
    yByXKey.set(String(xv), coerceCell(row[yKey]));
  }
  return sharedX.map((xv) => yByXKey.get(String(xv)) ?? 0);
}

// Inverse of Plotly's `makeBubbleSizeFn`; pick `sizeref` so the largest
// point lands at `desiredMaxPx`.
function computeSizeref(maxValue: number, desiredMaxPx: number, sizemode: "area" | "diameter") {
  if (!Number.isFinite(maxValue) || maxValue <= 0 || desiredMaxPx <= 0) {
    return 1;
  }
  if (sizemode === "diameter") {
    return maxValue / desiredMaxPx;
  }
  return maxValue / (desiredMaxPx * desiredMaxPx);
}

// Derive the chart-wide sizing factors from the size column; when unset,
// `values` stays undefined and traces fall back to a uniform scalar size.
function buildSizeContext(
  rows: Record<string, unknown>[],
  sizeColumn: string | undefined,
  chartConfig: ChartFormConfig,
): SizeContext {
  const sizemode: "area" | "diameter" = chartConfig.sizemode === "diameter" ? "diameter" : "area";
  const desiredMaxPx = chartConfig.bubbleMaxSize ?? 40;
  const sizemin = chartConfig.bubbleMinSize ?? 4;
  if (!sizeColumn) {
    return { values: undefined, fallbackSize: desiredMaxPx, sizemode, sizeref: 1, sizemin };
  }
  const values = rows.map((row) => Number(row[sizeColumn]));
  // Explicit loop instead of `Math.max(...values.filter(...), 0)`: spread
  // blows the JS arg stack at ~10k+ elements.
  let sharedMax = 0;
  for (const v of values) {
    if (Number.isFinite(v) && v > sharedMax) {
      sharedMax = v;
    }
  }
  return {
    values,
    fallbackSize: desiredMaxPx,
    sizemode,
    sizeref: computeSizeref(sharedMax, desiredMaxPx, sizemode),
    sizemin,
  };
}

function toAreaMode(mode: ChartFormConfig["mode"]): CartesianSeries["mode"] {
  if (mode === "lines+markers" || mode === "none") {
    return mode;
  }
  return "lines";
}

// Build the series marker, overlaying per-series concerns (point-level
// continuous color, bubble sizes, colorbar) on the chart-level `marker`.
function buildMarker({
  chartConfig,
  fallbackColor,
  continuousColorValues,
  sizeContext,
}: {
  chartConfig: ChartFormConfig;
  fallbackColor: string | undefined;
  continuousColorValues?: number[];
  sizeContext?: SizeContext | null;
}): MarkerConfig {
  const markerBase = chartConfig.marker;
  const colorscale = continuousColorValues ? markerBase?.colorscale : undefined;
  const showscale = continuousColorValues ? markerBase?.showscale : undefined;
  // Colorbar metadata only applies when a colorscale is in play; otherwise
  // Plotly emits a "no colorscale" warning and may render an empty bar.
  const colorbar =
    continuousColorValues && markerBase?.showscale
      ? {
          title: {
            text: markerBase.colorbar?.title?.text,
            font: markerBase.colorbar?.title?.font,
            side: markerBase.colorbar?.title?.side,
          },
          thickness: 15,
          len: 0.9,
        }
      : undefined;

  return {
    color: continuousColorValues ?? markerBase?.color ?? fallbackColor,
    symbol: markerBase?.symbol ?? "circle",
    opacity: markerBase?.opacity,
    colorscale,
    showscale,
    colorbar,
    line: markerBase?.line,
    size: sizeContext?.values ?? sizeContext?.fallbackSize ?? markerBase?.size,
  };
}

// Translate one Y source into a CartesianSeries; per-series `traceType` +
// `axis` overrides win, rest of the style comes from chart-level config.
function buildSeries({
  chartConfig,
  source,
  defaultTraceType,
  seriesOrdinal,
  fallbackColor,
  continuousColorValues,
  sizeContext,
  legendgroup,
  name,
  x,
  y,
  errorValues,
}: BuildSeriesArgs): CartesianSeries {
  const errorY: CartesianSeries["error_y"] = errorValues
    ? {
        type: "data",
        array: errorValues,
        visible: true,
        thickness: chartConfig.errorBarThickness ?? 1.5,
        width: chartConfig.errorBarCapWidth ?? 4,
        color: fallbackColor,
      }
    : chartConfig.error_y;
  const isFirstSeries = seriesOrdinal === 0;
  const traceType = isFirstSeries ? defaultTraceType : (source.traceType ?? defaultTraceType);
  const axis = isFirstSeries ? "primary" : (source.axis ?? "primary");
  const orientation = traceType === "bar" ? (chartConfig.orientation ?? "v") : undefined;

  if (traceType === "area") {
    const stackMode = chartConfig.stackMode ?? "none";
    // Per-axis so primary and secondary stack independently.
    const stackgroup = stackMode === "none" ? undefined : `stack-${axis}`;
    const groupnorm = stackMode === "percent" ? "percent" : "";
    const fillOpacity = chartConfig.fillOpacity ?? 0.4;
    return {
      traceType,
      axis,
      x,
      y,
      name,
      legendgroup,
      color: fallbackColor,
      fill: stackgroup ? undefined : "tozeroy",
      fillcolor: withAlpha(fallbackColor, fillOpacity),
      line: chartConfig.line,
      marker: chartConfig.marker,
      mode: toAreaMode(chartConfig.mode),
      connectgaps: chartConfig.connectgaps,
      stackgroup,
      groupnorm: stackgroup ? groupnorm : undefined,
      opacity: 1,
      text: chartConfig.text,
      textposition: chartConfig.textposition,
      textfont: chartConfig.textfont,
      error_x: chartConfig.error_x,
      error_y: errorY,
    };
  }

  const isScatter = traceType === "scatter";
  const marker = isScatter
    ? buildMarker({ chartConfig, fallbackColor, continuousColorValues, sizeContext })
    : chartConfig.marker;

  const seriesMode = resolveSeriesMode(traceType, chartConfig.mode);

  return {
    traceType,
    axis,
    orientation,
    x,
    y,
    name,
    legendgroup,
    color: fallbackColor,
    mode: seriesMode,
    line: chartConfig.line,
    marker,
    fill: chartConfig.fill,
    fillcolor: chartConfig.fillcolor,
    connectgaps: chartConfig.connectgaps,
    sizemode: isScatter ? sizeContext?.sizemode : undefined,
    sizeref: isScatter ? sizeContext?.sizeref : undefined,
    sizemin: isScatter ? sizeContext?.sizemin : undefined,
    text: chartConfig.text,
    textposition: chartConfig.textposition as CartesianSeries["textposition"],
    textfont: chartConfig.textfont,
    error_x: chartConfig.error_x,
    error_y: errorY,
  };
}

// Length-aligned with y: a null/non-numeric cell coerces to 0 (no visible bar).
function readErrorValues(
  rows: Record<string, unknown>[],
  errorColumn: string | undefined,
): number[] | undefined {
  if (!errorColumn) {
    return undefined;
  }
  return rows.map((row) => {
    const v = row[errorColumn];
    return typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0;
  });
}
