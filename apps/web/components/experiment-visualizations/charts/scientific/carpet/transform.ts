import type { ExperimentDataSourceConfig } from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";
import type { CarpetContourSeriesData, CarpetSeriesData } from "@repo/ui/components/charts/carpet";

import type { ChartFormConfig } from "../../chart-config";
import { resolveColorscale } from "../../colors/colorscales";
import { rowKeyForSource } from "../../data/aggregation";
import { dataSourcesByRole } from "../../data/data-sources";
import { pivotToMatrix } from "../../data/pivot-to-matrix";

export type CarpetDegenerateReason = "sameColumnAxes" | "singleAxisValue" | "flatZ" | "sparseGrid";

// Single pass coerce + short-circuit. Returns null on the first non-numeric so
// the caller bails before allocating the expanded grid.
function toNumericAxis(values: readonly (string | number)[]): number[] | null {
  const out = new Array<number>(values.length);
  for (let i = 0; i < values.length; i++) {
    const n = Number(values[i]);
    if (!Number.isFinite(n)) return null;
    out[i] = n;
  }
  return out;
}

export interface CarpetTransformResult {
  carpetData: CarpetSeriesData[];
  contourData: CarpetContourSeriesData[];
  degenerateReason: CarpetDegenerateReason | null;
}

/** Pure data transform for the carpet chart: pivots (x, y, z) rows into Plotly's carpet matrix plus its contour overlay. */
export function transformCarpetData(
  rows: Record<string, unknown>[],
  dataSources: ExperimentDataSourceConfig[],
  chartConfig: ChartFormConfig,
): CarpetTransformResult {
  const xColumn = dataSourcesByRole(dataSources, "x")[0]?.source.columnName;
  const yColumn = dataSourcesByRole(dataSources, "y")[0]?.source.columnName;
  const zEntry = dataSourcesByRole(dataSources, "z").at(0);
  if (!zEntry || !xColumn || !yColumn) {
    return { carpetData: [], contourData: [], degenerateReason: null };
  }
  const zColumn = zEntry.source.columnName;
  if (!zColumn) {
    return { carpetData: [], contourData: [], degenerateReason: null };
  }

  if (xColumn === yColumn) {
    return { carpetData: [], contourData: [], degenerateReason: "sameColumnAxes" };
  }

  const zRowKey = rowKeyForSource(zEntry.source, zEntry.index);

  const { xCategories, yCategories, z } = pivotToMatrix(rows, xColumn, yColumn, zRowKey);

  if (xCategories.length === 0 || yCategories.length === 0) {
    return { carpetData: [], contourData: [], degenerateReason: null };
  }

  if (xCategories.length < 2 || yCategories.length < 2) {
    return { carpetData: [], contourData: [], degenerateReason: "singleAxisValue" };
  }

  let firstFinite: number | null = null;
  let zHasDistinct = false;
  let filledCells = 0;
  for (const row of z) {
    for (const v of row) {
      if (!Number.isFinite(v)) {
        continue;
      }
      filledCells += 1;
      if (firstFinite === null) {
        firstFinite = v;
      } else if (v !== firstFinite) zHasDistinct = true;
    }
  }
  if (!zHasDistinct) {
    return { carpetData: [], contourData: [], degenerateReason: "flatZ" };
  }

  // Same 10% sparse-grid threshold as heatmap/contour.
  const totalCells = xCategories.length * yCategories.length;
  if (filledCells / totalCells < 0.1) {
    return { carpetData: [], contourData: [], degenerateReason: "sparseGrid" };
  }

  const aValuesNumeric = toNumericAxis(xCategories);
  const bValuesNumeric = toNumericAxis(yCategories);
  if (aValuesNumeric === null || bValuesNumeric === null) {
    return { carpetData: [], contourData: [], degenerateReason: "singleAxisValue" };
  }

  // Plotly carpet needs a/b/x/y all length M*N for explicit screen coords.
  const expandedA: number[] = [];
  const expandedB: number[] = [];
  const expandedX: number[] = [];
  const expandedY: number[] = [];
  for (const a of aValuesNumeric) {
    for (const b of bValuesNumeric) {
      expandedA.push(a);
      expandedB.push(b);
      expandedX.push(a);
      expandedY.push(b);
    }
  }

  // Plotly contourcarpet z is z[bIdx][aIdx] (heatmap/convert_column_xyz.js
  // bins 1D columns rows=b, cols=a). pivotToMatrix already returns that.
  const carpetZ: number[][] = [];
  for (let j = 0; j < bValuesNumeric.length; j++) {
    const row: number[] = [];
    for (let i = 0; i < aValuesNumeric.length; i++) {
      row.push(z[j]?.[i] ?? NaN);
    }
    carpetZ.push(row);
  }

  const coloring = chartConfig.carpetContourColoring ?? "fill";
  const ncontours = Math.max(2, Math.floor(chartConfig.carpetNContours ?? 15));
  const showLabels = Boolean(chartConfig.carpetShowContourLabels);

  // Pass explicit contour bounds; Plotly's autocontour state collapses to
  // start >= end on style-toggle re-renders and crashes makeCrossings.
  let zMin = Number.POSITIVE_INFINITY;
  let zMax = Number.NEGATIVE_INFINITY;
  for (const row of carpetZ) {
    for (const v of row) {
      if (!Number.isFinite(v)) continue;
      if (v < zMin) zMin = v;
      if (v > zMax) zMax = v;
    }
  }
  const zSpan = zMax - zMin;
  const contourSize = zSpan / ncontours;
  const contourStart = zMin + contourSize / 2;
  const contourEnd = zMax - contourSize / 2;

  const showGrid = chartConfig.showGrid !== false;

  return {
    carpetData: [
      {
        a: expandedA,
        b: expandedB,
        x: expandedX,
        y: expandedY,
        aaxis: { title: xColumn, showgrid: showGrid },
        baxis: { title: yColumn, showgrid: showGrid },
      },
    ],
    contourData: [
      {
        a: aValuesNumeric,
        b: bValuesNumeric,
        z: carpetZ,
        colorscale: resolveColorscale(chartConfig.carpetColorscale ?? "Viridis"),
        reversescale: Boolean(chartConfig.carpetReverseScale),
        showscale: chartConfig.carpetShowColorbar !== false,
        ncontours,
        contours: {
          start: contourStart,
          end: contourEnd,
          size: contourSize,
          // Labels need lines to attach to.
          showlines: coloring !== "fill" || showLabels,
          showlabels: showLabels,
          coloring,
        },
        colorbar:
          chartConfig.carpetColorbarTitle && chartConfig.carpetColorbarTitle.length > 0
            ? { title: chartConfig.carpetColorbarTitle, titleside: "right" }
            : undefined,
      },
    ],
    degenerateReason: null,
  };
}
