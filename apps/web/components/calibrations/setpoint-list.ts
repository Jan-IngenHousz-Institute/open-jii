import type { Stimulus } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

/** A sweep's points: numbers for an instrument, and labels too when the operator drives it. */
export type SetpointValue = Extract<Stimulus, { operator: string }>["values"][number];

/** The most points a sweep may hold, as the procedure contract counts them. */
const MAX_POINTS = 64;

export function formatSetpoints(values: SetpointValue[]): string {
  return values
    .map((value) => (typeof value === "object" ? JSON.stringify(value) : String(value)))
    .join(", ");
}

/**
 * A comma-separated list back into setpoints, or null when any entry is not one yet.
 *
 * Null rather than a partial list: committing "0.8, " as a single point would silently drop
 * what the author was still typing.
 */
export function parseSetpoints(text: string, numbersOnly: boolean): SetpointValue[] | null {
  const parts = text
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");

  if (parts.length === 0 || parts.length > MAX_POINTS) {
    return null;
  }

  const values: SetpointValue[] = [];
  for (const part of parts) {
    const asNumber = Number(part);
    if (Number.isFinite(asNumber)) {
      values.push(asNumber);
      continue;
    }
    if (numbersOnly) {
      return null;
    }
    values.push(part);
  }

  return values;
}
