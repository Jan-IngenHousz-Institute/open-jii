import type { DataSourceConfig } from "@repo/api/schemas/experiment.schema";
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

// Plotly's `contourcarpet` reads `reversescale` at the trace root, but
// `CarpetContourSeriesData` from the UI wrapper doesn't expose it. Widen
// the element type here rather than casting at each emit site.
type CarpetContourSeriesDataWithReverse = CarpetContourSeriesData & {
  reversescale?: boolean;
};

export interface CarpetTransformResult {
  carpetData: CarpetSeriesData[];
  contourData: CarpetContourSeriesDataWithReverse[];
  degenerateReason: CarpetDegenerateReason | null;
}

/** Pure data transform for the carpet chart: pivots (x, y, z) rows into Plotly's carpet matrix plus its contour overlay. */
export function transformCarpetData(
  rows: Record<string, unknown>[],
  dataSources: DataSourceConfig[],
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

  // Carpet trace: a/b/x/y all length M*N. Without x/y Plotly draws nothing.
  // x=a, y=b lays the carpet out as a plain rectangular grid.
  const expandedA: number[] = [];
  const expandedB: number[] = [];
  const expandedX: number[] = [];
  const expandedY: number[] = [];
  for (let i = 0; i < aValuesNumeric.length; i++) {
    for (let j = 0; j < bValuesNumeric.length; j++) {
      expandedA.push(aValuesNumeric[i]);
      expandedB.push(bValuesNumeric[j]);
      expandedX.push(aValuesNumeric[i]);
      expandedY.push(bValuesNumeric[j]);
    }
  }

  // contourcarpet wants z[aIdx][bIdx] (rows = a, cols = b). pivotToMatrix
  // returns z[yi][xi] = z[bIdx][aIdx], so transpose.
  const carpetZ: number[][] = [];
  for (let i = 0; i < aValuesNumeric.length; i++) {
    const row: number[] = [];
    for (let j = 0; j < bValuesNumeric.length; j++) {
      row.push(z[j]?.[i] ?? NaN);
    }
    carpetZ.push(row);
  }

  const coloring = chartConfig.carpetContourColoring ?? "fill";
  const ncontours = Math.max(2, Math.floor(chartConfig.carpetNContours ?? 15));
  const showLabels = Boolean(chartConfig.carpetShowContourLabels);

  return {
    carpetData: [
      {
        a: expandedA,
        b: expandedB,
        x: expandedX,
        y: expandedY,
        aaxis: { title: xColumn },
        baxis: { title: yColumn },
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
          // Labels need lines to attach to; force lines on when labels are
          // requested so Plotly's label-placement doesn't read undefined.
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
