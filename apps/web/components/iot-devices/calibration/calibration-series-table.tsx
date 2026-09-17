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

import { formatSeriesValue } from "./format-series-value";

type SeriesRow = CalibrationRunPayload[string][number];

/** The column every sweep carries, holding the setpoint that produced the row. */
const STIMULUS = "stimulus";

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

  // A long reading is held inside its cell rather than cut down, so the row stays
  // readable while the measurement itself can still be selected, copied or searched.
  function renderCell(row: SeriesRow, column: string) {
    const text = formatSeriesValue(row[column]);
    return (
      <TableCell key={column} className="px-3 py-1.5 font-mono text-xs">
        <span className="max-w-88 block truncate" title={text}>
          {text}
        </span>
      </TableCell>
    );
  }

  function renderRow(row: SeriesRow, index: number) {
    return (
      <TableRow key={`${series}:${String(index)}`}>
        {columns.map((column) => renderCell(row, column))}
      </TableRow>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableCaption className="mb-3 mt-2 caption-top text-left text-sm font-medium">
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
