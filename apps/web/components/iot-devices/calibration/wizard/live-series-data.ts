import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import type { ProcedureProgress } from "@repo/iot";

export interface LiveTrace {
  name: string;
  x: number[];
  y: number[];
}

export interface LiveSeries {
  series: string;
  /** How many points the procedure declared, or null for a read step, which takes one. */
  expected: number | null;
  taken: number;
  traces: LiveTrace[];
}

/** The reserved column every sweep row carries; it is the axis, not a reading. */
const STIMULUS = "stimulus";

/** How many points the step that produces this series will take. */
function expectedPoints(procedure: CaptureProcedure | undefined, series: string): number | null {
  const step = procedure?.steps.find(
    (candidate) =>
      (candidate.kind === "sweep" || candidate.kind === "read") && candidate.series === series,
  );
  if (step?.kind === "sweep") {
    return step.stimulus.values.length;
  }
  return step?.kind === "read" ? 1 : null;
}

/**
 * The series being measured right now, as points to draw.
 *
 * A sweep is minutes of waiting and its shape is the thing an instrument person reads
 * instantly, so the curve is built from the points as they are kept rather than shown as a
 * table once the whole run is over. Only numeric columns can be drawn; a structured reply or
 * a typed note still reaches the record, it just is not a line.
 */
export function liveSeriesData(
  events: ProcedureProgress[],
  procedure: CaptureProcedure | undefined,
): LiveSeries | null {
  const lastRow = events.findLast((event) => event.kind === "row");
  if (lastRow?.kind !== "row") {
    return null;
  }

  const series = lastRow.series;
  // A series already declared complete is the previous step's, not what is being measured.
  const isFinished = events.some((event) => event.kind === "series" && event.series === series);
  if (isFinished) {
    return null;
  }

  const rows = events.filter((event) => event.kind === "row" && event.series === series);
  const columns = new Set<string>();
  for (const event of rows) {
    if (event.kind !== "row") continue;
    for (const [column, cell] of Object.entries(event.row)) {
      if (column !== STIMULUS && typeof cell === "number") {
        columns.add(column);
      }
    }
  }

  const traces = [...columns].map((column) => {
    const x: number[] = [];
    const y: number[] = [];
    for (const [position, event] of rows.entries()) {
      if (event.kind !== "row") continue;
      const value = event.row[column];
      if (typeof value !== "number") continue;
      const stimulus = event.row[STIMULUS];
      // A read step has no stimulus of its own, so the point's position is its axis.
      x.push(typeof stimulus === "number" ? stimulus : position + 1);
      y.push(value);
    }
    return { name: column, x, y };
  });

  return {
    series,
    expected: expectedPoints(procedure, series),
    taken: rows.length,
    traces: traces.filter((trace) => trace.y.length > 0),
  };
}
