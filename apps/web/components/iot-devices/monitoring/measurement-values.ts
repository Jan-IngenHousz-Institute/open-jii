import type { ExperimentColumnPrimitiveType } from "@repo/api/domains/experiment/data/experiment-data.schema";
import type { DeviceMeasurement } from "@repo/api/domains/iot/iot.schema";

// A device defines its own reading shape, so the table adapts to what arrived
// rather than assuming a schema. Beyond this many columns the table stops
// being readable and the surplus is disclosed rather than silently dropped.
const MAX_VALUE_COLUMNS = 8;

export interface MeasurementValueRow {
  timestamp: string;
  values: Record<string, unknown>;
}

export interface MeasurementValueTable {
  columns: string[];
  rows: MeasurementValueRow[];
  /** Fields present in the data but beyond the column budget. */
  hiddenColumnCount: number;
}

/**
 * Flatten stored samples into a table. A sample is device-defined JSON: either
 * one object of readings or an array of them (a burst). Values stay raw so the
 * shared cell formatter can type them the way the experiment data tables do.
 */
export function buildMeasurementValueTable(
  measurements: DeviceMeasurement[],
): MeasurementValueTable {
  const rows: MeasurementValueRow[] = [];
  const seen = new Map<string, number>();

  for (const measurement of measurements) {
    const readings = parseReadings(measurement.sample);
    for (const reading of readings) {
      const values: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(reading)) {
        if (value === null || value === undefined) {
          continue;
        }
        values[key] = value;
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }

      if (Object.keys(values).length > 0) {
        rows.push({ timestamp: measurement.timestamp, values });
      }
    }
  }

  // Most-populated fields first: a field present on every reading is more
  // useful than one that appeared once.
  const ranked = [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key);

  return {
    columns: ranked.slice(0, MAX_VALUE_COLUMNS),
    rows,
    hiddenColumnCount: Math.max(0, ranked.length - MAX_VALUE_COLUMNS),
  };
}

function parseReadings(sample: string | null): Record<string, unknown>[] {
  if (sample === null) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(sample);
    if (Array.isArray(parsed)) {
      return parsed.filter(isRecord);
    }
    return isRecord(parsed) ? [parsed] : [];
  } catch {
    // A sample that will not parse is not tabulated; the row-level table in
    // the data-flow panel still shows the measurement arrived.
    return [];
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The column type the shared formatter should render this field as. */
export function inferColumnType(value: unknown): ExperimentColumnPrimitiveType {
  if (typeof value === "number") {
    return Number.isInteger(value) ? "INT" : "DOUBLE";
  }
  if (typeof value === "boolean") {
    return "BOOLEAN";
  }
  if (typeof value === "object") {
    return "VARIANT";
  }
  return "STRING";
}
