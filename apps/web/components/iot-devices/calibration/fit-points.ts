import { RETAKEN_SERIES_SUFFIX } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import type {
  CalibrationBlocks,
  CalibrationRunPayload,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";

import type { FitPoint } from "./calibration-fit-chart";

/**
 * Read off the captured series by convention: the first two numeric columns of the
 * first series, device first and reference second.
 *
 * Readings the operator took again are skipped. A retake at the first setpoint puts the
 * discarded rows into the payload before the kept ones, so charting the first series
 * positionally would show the approver exactly the readings that were thrown away.
 */
export function fitPointsFromPayload(payload: CalibrationRunPayload): FitPoint[] {
  const series = Object.entries(payload)
    .filter(([name]) => !name.endsWith(RETAKEN_SERIES_SUFFIX))
    .map(([, rows]) => rows)
    .at(0);
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

/** The first block that describes a line, which is the one the chart draws. */
export function fitLineFromBlocks(
  blocks: CalibrationBlocks | null,
): { slope: number; intercept: number } | null {
  return (
    Object.values(blocks ?? {})
      .map((block) => (block.coefficients ? fitLineFromCoefficients(block.coefficients) : null))
      .find((line) => line !== null) ?? null
  );
}
