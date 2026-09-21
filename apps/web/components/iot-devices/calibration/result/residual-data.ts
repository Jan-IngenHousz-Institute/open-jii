import type { CalibrationBlock } from "@repo/api/domains/iot/calibration/iot-calibration.schema";

export interface ResidualPoint {
  /** The setpoint the point was taken at, or its position when the fit recorded no axis. */
  x: number;
  /** How far the fit missed, as a fraction of the fitted range. */
  fraction: number;
}

export interface ResidualReport {
  points: ResidualPoint[];
  /** The band the gate allowed, as a fraction; absent when the script declared none. */
  tolerance: number | null;
  xLabel: string | null;
  /** True when the script capped how many residuals it reported. */
  truncated: boolean;
}

function numbers(value: unknown): number[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const found = value.filter((entry): entry is number => typeof entry === "number");
  return found.length === value.length ? found : null;
}

function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * The span the residuals were judged against.
 *
 * The scripts report a worst residual both in the reading's own units and as a fraction of
 * the fitted range, so the range is the ratio between them. Deriving it is what lets every
 * residual be drawn on the same axis as the threshold the gate applied, rather than in units
 * the threshold is not expressed in.
 */
function fullScale(quality: Record<string, unknown>): number | null {
  const worst = numeric(quality.worst_residual);
  const fraction = numeric(quality.worst_residual_fraction);
  if (worst === null || fraction === null || fraction === 0) {
    return null;
  }
  return Math.abs(worst / fraction);
}

/** Where the fit missed, point by point, against the band the gate allowed. */
export function residualReport(block: CalibrationBlock): ResidualReport | null {
  const quality = block.quality;
  if (!quality) {
    return null;
  }

  const residuals = numbers(quality.residuals);
  const scale = fullScale(quality);
  if (residuals === null || residuals.length === 0 || scale === null) {
    return null;
  }

  // The chart the script recorded holds the x of every pair it fitted, in the same order as
  // the residuals, so a residual can be shown against the setpoint that produced it.
  const chart = quality.chart;
  const pairs =
    typeof chart === "object" && chart !== null ? (chart as Record<string, unknown>).points : null;
  const axis = Array.isArray(pairs)
    ? pairs.map((pair) => (Array.isArray(pair) && typeof pair[0] === "number" ? pair[0] : null))
    : [];

  const points = residuals.map((residual, index) => ({
    x: axis[index] ?? index + 1,
    fraction: residual / scale,
  }));

  const thresholds = quality.thresholds;
  const tolerance =
    typeof thresholds === "object" && thresholds !== null
      ? numeric((thresholds as Record<string, unknown>).max_full_scale_residual)
      : null;

  const label =
    typeof chart === "object" && chart !== null ? (chart as Record<string, unknown>).x : undefined;

  return {
    points,
    tolerance,
    xLabel: typeof label === "string" ? label : null,
    truncated: quality.residuals_truncated === true,
  };
}
