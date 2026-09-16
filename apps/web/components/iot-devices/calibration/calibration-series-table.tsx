"use client";

import type { CalibrationRunPayload } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { useTranslation } from "@repo/i18n";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";

type SeriesRow = CalibrationRunPayload[string][number];
type Cell = SeriesRow[string];

/** The column every sweep carries, holding the setpoint that produced the row. */
const STIMULUS = "stimulus";

/** Long enough to read, short enough not to push the numeric columns off the row. */
const MAX_CELL_LENGTH = 48;

// Rows in one series need not carry every column, so a cell can genuinely be absent.
function formatCell(value: Cell | undefined): string {
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

  const text = String(value);
  return text.length > MAX_CELL_LENGTH ? `${text.slice(0, MAX_CELL_LENGTH)}…` : text;
}

/** Columns in the order the procedure named them, with the setpoint first. */
function columnsOf(rows: SeriesRow[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) {
    for (const column of Object.keys(row)) {
      seen.add(column);
    }
  }

  const columns = [...seen];
  return columns.sort((left, right) =>
    left === STIMULUS
      ? -1
      : right === STIMULUS
        ? 1
        : columns.indexOf(left) - columns.indexOf(right),
  );
}

/**
 * What the bench actually measured, one table per series. A reviewer approving a
 * calibration on its coefficients alone cannot see a point that went wrong; this is the
 * evidence the fit was drawn from.
 */
export function CalibrationSeriesTable({ series, rows }: { series: string; rows: SeriesRow[] }) {
  const { t } = useTranslation("iot");
  const columns = columnsOf(rows);

  if (rows.length === 0) {
    return null;
  }

  function renderRow(row: SeriesRow, index: number) {
    return (
      <TableRow key={`${series}:${String(index)}`}>
        {columns.map((column) => (
          <TableCell key={column} className="px-3 py-1.5 font-mono text-xs">
            {formatCell(row[column])}
          </TableCell>
        ))}
      </TableRow>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableCaption className="mb-3 mt-2 text-left text-sm font-medium">
          {t("iot.calibration.review.seriesCaption", { series, points: rows.length })}
        </TableCaption>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column} className="px-3 py-2 text-xs">
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>{rows.map(renderRow)}</TableBody>
      </Table>
    </div>
  );
}
