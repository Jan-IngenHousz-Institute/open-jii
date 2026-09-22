import type { CalibrationBlock } from "@repo/api/domains/iot/calibration/iot-calibration.schema";

import type { FitPoint } from "./calibration-fit-chart";

/** The line a block's coefficients describe: `slope`/`intercept`, or a lone gain through the origin. */
export interface FitLine {
  slope: number;
  intercept: number;
}

/**
 * What a block can be shown as. A fitted block draws the pairs it was fitted through with
 * its line over them; a block whose coefficient is a vector draws one bar per element.
 */
export type BlockChart =
  | { kind: "fit"; x: string; y: string; points: FitPoint[]; line: FitLine | null }
  | { kind: "vector"; name: string; values: number[] };

type Coefficients = NonNullable<CalibrationBlock["coefficients"]>;

function fitLine(coefficients: Coefficients | undefined): FitLine | null {
  if (coefficients === undefined) {
    return null;
  }
  const slope = coefficients.slope;
  if (typeof slope === "number") {
    const intercept = coefficients.intercept;
    return { slope, intercept: typeof intercept === "number" ? intercept : 0 };
  }
  // A single-coefficient block is a gain: the line through the origin it describes.
  const values = Object.values(coefficients);
  const gain = values.length === 1 ? values[0] : undefined;
  return typeof gain === "number" ? { slope: gain, intercept: 0 } : null;
}

/**
 * The pairs the script recorded as the ones it fitted. Only the script knows them: a
 * reading can arrive inside a structured reply, and a retake leaves rows in the payload
 * that never reached the fit.
 */
function fittedPoints(quality: CalibrationBlock["quality"]): BlockChart | null {
  const chart: unknown = quality?.chart;
  if (typeof chart !== "object" || chart === null) {
    return null;
  }
  const { x, y, points } = chart as Record<string, unknown>;
  if (typeof x !== "string" || typeof y !== "string" || !Array.isArray(points)) {
    return null;
  }

  const pairs: FitPoint[] = [];
  for (const point of points) {
    if (Array.isArray(point) && typeof point[0] === "number" && typeof point[1] === "number") {
      pairs.push({ x: point[0], y: point[1] });
    }
  }
  return pairs.length === 0 ? null : { kind: "fit", x, y, points: pairs, line: null };
}

function vectorCoefficient(coefficients: Coefficients | undefined): BlockChart | null {
  for (const [name, value] of Object.entries(coefficients ?? {})) {
    if (Array.isArray(value) && value.length > 0) {
      return { kind: "vector", name, values: value };
    }
  }
  return null;
}

/** The picture this block is owed, or nothing when it carries neither a fit nor a vector. */
export function blockChart(block: CalibrationBlock): BlockChart | null {
  const fitted = fittedPoints(block.quality);
  if (fitted !== null && fitted.kind === "fit") {
    return { ...fitted, line: fitLine(block.coefficients) };
  }
  return vectorCoefficient(block.coefficients);
}
