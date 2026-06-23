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

  // Carpet's a is the X factor axis, b is the Y factor axis. Plotly's
  // `carpet` trace renders in grid mode when `a` is the 1D array of
  // unique a-values (length M) and `b` is the 1D array of unique
  // b-values (length N); the cheater projection then lays out a uniform
  // M×N grid. Emitting M*N expanded arrays without matching `x`/`y` was
  // the broken middle state — Plotly drew nothing.
  //
  // pivotToMatrix returns z[yi][xi]; transpose to the carpet's
  // [aIdx][bIdx] for the contour overlay (a along the rows, b along the
  // columns), matching how Plotly's contourcarpet indexes z.
  const aValuesNumeric = toNumericAxis(xCategories);
  const bValuesNumeric = toNumericAxis(yCategories);
  if (aValuesNumeric === null || bValuesNumeric === null) {
    // Numeric-only role contract should prevent this, but a stale
    // dataConfig on a renamed column could land here.
    return { carpetData: [], contourData: [], degenerateReason: "singleAxisValue" };
  }

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
        a: aValuesNumeric,
        b: bValuesNumeric,
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
          showlines: coloring !== "fill",
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
