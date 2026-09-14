"use client";

import type { CalibrationRunPayload } from "@repo/api/domains/iot/calibration/iot-calibration.schema";

type Cell = CalibrationRunPayload[string][number][string];

function formatCell(cell: Cell): string {
  if (typeof cell === "number") return Number(cell.toPrecision(6)).toString();
  if (typeof cell === "string" || typeof cell === "boolean") return String(cell);
  if (Array.isArray(cell)) return cell.map((entry) => Number(entry.toPrecision(6))).join(", ");
  return JSON.stringify(cell);
}

/** What the verify phase read after the write, one table per series, as the operator saw it. */
export function CalibrationVerificationReadings({
  verification,
}: {
  verification: CalibrationRunPayload;
}) {
  function renderSeries([series, rows]: [string, CalibrationRunPayload[string]]) {
    const columns = Object.keys(rows[0] ?? {});
    return (
      <div key={series} className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="text-muted-foreground mb-1 text-left text-xs font-medium uppercase tracking-wide">
            {series}
          </caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column} className="text-muted-foreground pr-4 font-normal">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {columns.map((column) => (
                  <td key={column} className="pr-4 font-mono">
                    {formatCell(row[column])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return <div className="space-y-3">{Object.entries(verification).map(renderSeries)}</div>;
}
