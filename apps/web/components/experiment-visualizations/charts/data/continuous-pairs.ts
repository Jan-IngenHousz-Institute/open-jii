import { detectAxisType } from "@repo/ui/components/charts/utils";

import { coerceCell } from "./cell-coercion";

function continuousCell(value: unknown): string | number | null {
  const cell = coerceCell(value);
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : null;
  if (typeof cell !== "string") return null;
  return detectAxisType([cell]) === "date" && Number.isFinite(Date.parse(cell)) ? cell : null;
}

/** Keep paired finite numbers or ISO timestamps, with one consistent kind per axis. */
export function continuousPairs(
  rows: Record<string, unknown>[],
  xColumn: string,
  yColumn: string,
): { x: (string | number)[]; y: (string | number)[] } {
  const pairs: { x: string | number; y: string | number }[] = [];
  for (const row of rows) {
    const x = continuousCell(row[xColumn]);
    const y = continuousCell(row[yColumn]);
    if (x !== null && y !== null) pairs.push({ x, y });
  }

  // A mixed numeric/date axis stays numeric, as in detectAxisType. Passing both
  // to a date axis would make Plotly interpret small numbers as calendar years.
  const xType = detectAxisType(pairs.map((pair) => pair.x));
  const yType = detectAxisType(pairs.map((pair) => pair.y));
  const x: (string | number)[] = [];
  const y: (string | number)[] = [];
  for (const pair of pairs) {
    if ((typeof pair.x === "string") !== (xType === "date")) continue;
    if ((typeof pair.y === "string") !== (yType === "date")) continue;
    x.push(pair.x);
    y.push(pair.y);
  }
  return { x, y };
}
