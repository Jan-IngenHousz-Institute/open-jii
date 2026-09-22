import type { DataRow } from "@/components/data-table/data-table-columns";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";
import type { CalibrationRunPayload } from "@repo/api/domains/iot/calibration/iot-calibration.schema";

import { formatSeriesValue } from "./format-series-value";

type SeriesRow = CalibrationRunPayload[string][number];
type SeriesCell = SeriesRow[string];

/** The column every sweep carries, holding the setpoint that produced the row. */
const STIMULUS = "stimulus";

/**
 * Warehouse type names, because the shared data table renders a cell by the type its
 * column declares: numbers right-aligned, a numeric array as a sparkline, a struct as
 * expandable JSON.
 */
const NUMBER = "DOUBLE";
const TEXT = "STRING";
const NUMBER_ARRAY = "ARRAY<DOUBLE>";
const STRUCT = "STRUCT";

function isRecord(value: SeriesCell): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A device that answers a structured reading reaches the record as that object's JSON text. */
function isStructText(value: SeriesCell): boolean {
  if (typeof value !== "string" || !value.startsWith("{")) {
    return false;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

/** One type for the column, so a series of mixed shapes falls back to text rather than lying. */
function columnType(values: SeriesCell[]): string {
  if (values.length === 0) {
    return TEXT;
  }
  if (values.every((value) => typeof value === "number")) {
    return NUMBER;
  }
  if (values.every((value) => Array.isArray(value))) {
    return NUMBER_ARRAY;
  }
  if (values.every((value) => isRecord(value) || isStructText(value))) {
    return STRUCT;
  }
  return TEXT;
}

/** A row need not carry every column the series declares. */
function isPresent(value: SeriesCell | null | undefined): value is SeriesCell {
  return value !== null && value !== undefined;
}

function toCell(value: SeriesCell | null | undefined, type: string): unknown {
  if (!isPresent(value)) {
    return null;
  }
  if (type === NUMBER) {
    return value;
  }
  // The array and struct cells parse what they are given, so an object travels as its JSON.
  if (type === NUMBER_ARRAY || type === STRUCT) {
    return typeof value === "string" ? value : JSON.stringify(value);
  }
  return formatSeriesValue(value);
}

/** Columns in the order the procedure named them, with the setpoint first. */
function columnNames(rows: SeriesRow[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    for (const column of Object.keys(row)) {
      seen.add(column);
    }
  }
  const names = [...seen];
  return names.sort((left, right) =>
    left === STIMULUS ? -1 : right === STIMULUS ? 1 : names.indexOf(left) - names.indexOf(right),
  );
}

/**
 * One captured series as the shared data table takes it: a column carrying the type its
 * readings share, and a row per point.
 */
export function seriesTableData(
  series: string,
  rows: SeriesRow[],
): { columns: ExperimentDataColumn[]; rows: DataRow[] } {
  const names = columnNames(rows);

  const columns = names.map((name) => {
    const type = columnType(rows.map((row) => row[name]).filter(isPresent));
    return { name, type_name: type, type_text: type };
  });

  const tableRows = rows.map((row, index) => {
    const cells: DataRow = { id: `${series}:${String(index)}` };
    for (const column of columns) {
      cells[column.name] = toCell(row[column.name], column.type_text);
    }
    return cells;
  });

  return { columns, rows: tableRows };
}
