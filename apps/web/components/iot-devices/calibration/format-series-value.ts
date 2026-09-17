import type { CalibrationRunPayload } from "@repo/api/domains/iot/calibration/iot-calibration.schema";

type SeriesValue = CalibrationRunPayload[string][number][string];

/**
 * One reading or setpoint as the bench produced it. A compound setpoint is a record and a
 * multi-sample reading is an array, so neither survives plain stringification: the
 * operator would be shown "[object Object]" where the setpoint should be.
 */
export function formatSeriesValue(value: SeriesValue | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number") {
    return Number(value.toPrecision(6)).toString();
  }
  if (Array.isArray(value)) {
    return value.map((entry) => Number(entry.toPrecision(6))).join(", ");
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, entry]) => `${key}: ${String(entry)}`)
      .join(", ");
  }
  return String(value);
}
