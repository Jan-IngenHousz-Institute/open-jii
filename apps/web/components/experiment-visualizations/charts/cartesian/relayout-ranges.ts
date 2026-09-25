import { rangeEdgePosition } from "./series-reduction";
import type { AxisRange } from "./series-reduction";

/** Visible x range per Plotly axis id (`x`, `x2`, ...); an axis showing everything has no entry. */
export type AxisRanges = Readonly<Partial<Record<string, AxisRange>>>;

const X_RANGE_KEY = /^xaxis(\d*)\.(autorange|range|range\[[01]\])$/;

/**
 * The x ranges after a Plotly relayout event: a zoom or pan sets an axis's range, a reset drops it.
 * Everything else a relayout reports (y ranges, autosize, drag mode) leaves them as they were.
 */
export function rangesAfterRelayout(
  current: AxisRanges,
  event: Readonly<Record<string, unknown>>,
): AxisRanges {
  const edges = new Map<string, [number | undefined, number | undefined]>();
  const resets = new Set<string>();

  for (const [key, value] of Object.entries(event)) {
    const match = X_RANGE_KEY.exec(key);
    if (!match) {
      continue;
    }
    const axisId = `x${match[1]}`;
    const part = match[2];

    if (part === "autorange") {
      resets.add(axisId);
      continue;
    }
    if (part === "range") {
      if (Array.isArray(value)) {
        edges.set(axisId, [rangeEdgePosition(value[0]), rangeEdgePosition(value[1])]);
      }
      continue;
    }
    const known = edges.get(axisId) ?? [current[axisId]?.[0], current[axisId]?.[1]];
    known[part === "range[0]" ? 0 : 1] = rangeEdgePosition(value);
    edges.set(axisId, known);
  }

  if (edges.size === 0 && resets.size === 0) {
    return current;
  }

  const kept = Object.entries(current).filter(
    (entry): entry is [string, AxisRange] => entry[1] !== undefined && !resets.has(entry[0]),
  );
  const moved = [...edges].flatMap(([axisId, [from, to]]): [string, AxisRange][] =>
    isKnown(from) && isKnown(to) && from < to ? [[axisId, [from, to]]] : [],
  );
  return Object.fromEntries([...kept, ...moved]);
}

function isKnown(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value);
}
