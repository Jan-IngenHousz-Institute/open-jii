import type { DataRow } from "@/components/data-table/data-table-columns";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";
import type { DeviceMeasurement } from "@repo/api/domains/iot/iot.schema";

export const MEASURED_AT_COLUMN = "measured_at";

export interface MeasurementValueTable {
  columns: ExperimentDataColumn[];
  rows: DataRow[];
}

/**
 * Flatten stored samples into warehouse-shaped columns and rows: one column
 * per reported field, typed from the values that arrived. A sample is one
 * JSON object of readings or a burst array; a burst becomes one row each.
 */
export function buildMeasurementValueTable(
  measurements: DeviceMeasurement[],
): MeasurementValueTable {
  const rows: DataRow[] = [];
  const fieldValues = new Map<string, unknown[]>();

  for (const [position, measurement] of measurements.entries()) {
    const readings = parseReadings(measurement.sample);

    for (const [readingIndex, reading] of readings.entries()) {
      const row: DataRow = {
        id: `${measurement.timestamp}-${String(position)}-${String(readingIndex)}`,
        [MEASURED_AT_COLUMN]: measurement.timestamp,
      };

      const fields = Object.entries(reading).filter(([, value]) => value !== null);
      for (const [field, value] of fields) {
        // Complex values travel as JSON text, like warehouse struct columns.
        row[field] = typeof value === "object" ? JSON.stringify(value) : value;
        fieldValues.set(field, [...(fieldValues.get(field) ?? []), value]);
      }

      if (fields.length > 0) {
        rows.push(row);
      }
    }
  }

  // Most-populated fields first.
  const ranked = [...fieldValues.entries()].sort((a, b) => b[1].length - a[1].length);

  return {
    columns: [
      { name: MEASURED_AT_COLUMN, type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
      ...ranked.map(([field, values]) => {
        const type = inferColumnType(values);
        return { name: field, type_name: type, type_text: type };
      }),
    ],
    rows,
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
    // Unparsable samples are not tabulated; the data-flow record table still
    // shows the measurement arrived.
    return [];
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The warehouse type a field is closest to, over every value seen for it.
 * Numeric arrays land on `ARRAY<DOUBLE>` so a spectrum plots as a sparkline;
 * disagreeing values fall back to text.
 */
export function inferColumnType(values: unknown[]): string {
  const types = new Set(values.map(nameOfType));

  // Whole numbers and fractions are one numeric field, not a disagreement.
  if (types.has("BIGINT") && types.has("DOUBLE")) {
    types.delete("BIGINT");
  }

  return types.size === 1 ? [...types][0] : "STRING";
}

function nameOfType(value: unknown): string {
  if (typeof value === "number") {
    return Number.isInteger(value) ? "BIGINT" : "DOUBLE";
  }
  if (typeof value === "boolean") {
    return "BOOLEAN";
  }
  if (Array.isArray(value)) {
    if (value.every((item) => typeof item === "number")) {
      return "ARRAY<DOUBLE>";
    }
    return value.some(isRecord) ? "ARRAY<STRUCT>" : "ARRAY<STRING>";
  }
  if (isRecord(value)) {
    return "VARIANT";
  }

  return "STRING";
}
