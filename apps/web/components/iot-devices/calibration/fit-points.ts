import type { CalibrationRunPayload } from "@repo/api/domains/iot/calibration/iot-calibration.schema";

import type { FitPoint } from "./calibration-fit-chart";

/**
 * Read off the captured series by convention: the first two numeric columns of the
 * first series, device first and reference second.
 */
export function fitPointsFromPayload(payload: CalibrationRunPayload): FitPoint[] {
  const series = Object.values(payload).at(0);
  const first = series?.at(0);
  if (series === undefined || first === undefined) return [];

  const numericColumns = Object.entries(first)
    .filter(([column, value]) => column !== "stimulus" && typeof value === "number")
    .map(([column]) => column);
  if (numericColumns.length < 2) return [];

  const [xColumn, yColumn] = numericColumns;
  const points: FitPoint[] = [];
  for (const row of series) {
    const x = row[xColumn];
    const y = row[yColumn];
    if (typeof x === "number" && typeof y === "number") {
      points.push({ x, y });
    }
  }
  return points;
}

/** The line a block's coefficients describe, when it is a line at all. */
export function fitLineFromCoefficients(
  coefficients: Partial<Record<string, number | number[]>>,
): { slope: number; intercept: number } | null {
  const slope = coefficients.slope ?? coefficients.spec;
  if (typeof slope !== "number") return null;
  const intercept = coefficients.intercept;
  return { slope, intercept: typeof intercept === "number" ? intercept : 0 };
}
