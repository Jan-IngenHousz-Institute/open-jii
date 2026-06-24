"use client";

import type { FacetGridConfig } from "@repo/ui/components/charts/cartesian-chart";
import { defaultFacetColumns } from "@repo/ui/components/charts/utils";

import type { ChartFormConfig } from "../chart-config";
import { toBucketKey } from "./cell-coercion";

export interface FacetCellContext {
  cellRows: Record<string, unknown>[];
  cellIndex: number;
  xaxisId: string | undefined;
  yaxisId: string | undefined;
  showlegend: boolean | undefined;
  globalCategoryKeys: string[];
  globalCategoryValues: (string | number | null)[];
}

export interface FacetGroupingOptions {
  rows: Record<string, unknown>[];
  facetColumn: string | undefined;
  colorColumn: string | undefined;
  chartConfig: ChartFormConfig;
}

export interface FacetGroupingResult<TSeries> {
  chartSeries: TSeries[];
  subplots: FacetGridConfig | undefined;
}

/**
 * Group rows by facet value, run a chart-specific cell builder per group,
 * and emit the corresponding `FacetGridConfig` for the wrapper.
 */
export function buildFacetSeries<TSeries>(
  options: FacetGroupingOptions,
  buildCellSeries: (ctx: FacetCellContext) => TSeries[],
): FacetGroupingResult<TSeries> {
  const { rows, facetColumn, colorColumn, chartConfig } = options;

  // Single pass over `rows` fills both the global category list (for
  // stable colors across cells) and the facet groups. The category
  // index must be stable across every cell so `getCategoryColor` is
  // consistent.
  const globalCategoryValues: (string | number | null)[] = [];
  const globalCategoryKeys: string[] = [];
  const categorySeen = colorColumn ? new Set<string>() : null;
  // Maps preserve insertion order, so first-seen facet ordering falls
  // out for free when we iterate the map below.
  const groupMap = facetColumn ? new Map<string, Record<string, unknown>[]>() : null;

  if (categorySeen || groupMap) {
    for (const row of rows) {
      if (categorySeen && colorColumn) {
        const raw = row[colorColumn];
        const key = toBucketKey(raw);
        if (!categorySeen.has(key)) {
          categorySeen.add(key);
          globalCategoryKeys.push(key);
          globalCategoryValues.push(raw == null ? null : (raw as string | number));
        }
      }
      if (groupMap && facetColumn) {
        const raw = row[facetColumn];
        const key = toBucketKey(raw);
        const bucket = groupMap.get(key);
        if (bucket) {
          bucket.push(row);
        } else {
          groupMap.set(key, [row]);
        }
      }
    }
  }

  // Sort alphabetically so palette indices match the picker's swatch order.
  if (globalCategoryKeys.length > 1) {
    const order = globalCategoryKeys.map((_, i) => i);
    order.sort((a, b) => globalCategoryKeys[a].localeCompare(globalCategoryKeys[b]));
    const sortedKeys = order.map((i) => globalCategoryKeys[i]);
    const sortedValues = order.map((i) => globalCategoryValues[i]);
    globalCategoryKeys.length = 0;
    globalCategoryKeys.push(...sortedKeys);
    globalCategoryValues.length = 0;
    globalCategoryValues.push(...sortedValues);
  }

  const facetGroups: { key: string; label: string; rows: Record<string, unknown>[] }[] = [];
  if (groupMap) {
    for (const [key, groupRows] of groupMap) {
      // Label is the same as key after stringification, except `""`
      // (null/undefined raw values) which gets the explicit `(none)`
      // placeholder. Computed at emission time, not per-row.
      facetGroups.push({ key, label: key === "" ? "(none)" : key, rows: groupRows });
    }
  } else {
    facetGroups.push({ key: "", label: "", rows });
  }

  const allSeries: TSeries[] = [];
  for (let i = 0; i < facetGroups.length; i++) {
    const xaxisId = !facetColumn ? undefined : i === 0 ? "x" : `x${i + 1}`;
    const yaxisId = !facetColumn ? undefined : i === 0 ? "y" : `y${i + 1}`;
    const showlegend = i === 0 ? undefined : false;
    allSeries.push(
      ...buildCellSeries({
        cellRows: facetGroups[i].rows,
        cellIndex: i,
        xaxisId,
        yaxisId,
        showlegend,
        globalCategoryKeys,
        globalCategoryValues,
      }),
    );
  }

  if (!facetColumn) {
    return { chartSeries: allSeries, subplots: undefined };
  }

  const totalCells = facetGroups.length;
  const requestedColumns = chartConfig.facetColumns;
  const cols =
    typeof requestedColumns === "number" && requestedColumns > 0
      ? Math.min(totalCells, Math.floor(requestedColumns))
      : defaultFacetColumns(totalCells);
  const gridRows = Math.ceil(totalCells / cols);
  const cells: FacetGridConfig["cells"] = facetGroups.map((group, i) => ({
    title: group.label,
    xaxisId: i === 0 ? "x" : `x${i + 1}`,
    yaxisId: i === 0 ? "y" : `y${i + 1}`,
  }));

  const subplots: FacetGridConfig = {
    rows: gridRows,
    columns: cols,
    cells,
    sharedX: chartConfig.facetSharedX !== false,
    sharedY: chartConfig.facetSharedY !== false,
    sharedXTitle: chartConfig.facetSharedXTitle !== false,
    sharedYTitle: chartConfig.facetSharedYTitle !== false,
    roworder: chartConfig.facetRowOrder === "bottom-to-top" ? "bottom to top" : "top to bottom",
  };

  return { chartSeries: allSeries, subplots };
}
