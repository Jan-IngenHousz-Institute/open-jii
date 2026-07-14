import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";

// Mirrors the backend drift projection (is-workbook-upgradable `designOf`): the
// upgrade diff must ignore the same runtime/UI artifacts so a re-run never shows
// as a change. Kept local + display-only; the backend stays the source of truth
// for the drift *decision*.
const RUNTIME_CELL_FIELDS = new Set([
  "isCollapsed",
  "isAnswered",
  "answer",
  "evaluatedPathId",
  "data",
  "executionTime",
  "messages",
]);

function stableStringify(value: unknown): string {
  const deepSort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(deepSort);
    if (v !== null && typeof v === "object") {
      const obj = v as Record<string, unknown>;
      return Object.keys(obj)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = deepSort(obj[key]);
          return acc;
        }, {});
    }
    return v;
  };
  return JSON.stringify(deepSort(value));
}

function designCell(cell: WorkbookCell): string {
  return stableStringify(
    Object.fromEntries(Object.entries(cell).filter(([k]) => !RUNTIME_CELL_FIELDS.has(k))),
  );
}

function labelOf(cell: WorkbookCell): string | undefined {
  switch (cell.type) {
    case "protocol":
    case "macro":
      return cell.payload.name;
    case "question":
      return cell.name;
    default:
      return undefined;
  }
}

export type CellChangeType = "added" | "removed" | "changed" | "moved";

export interface CellChange {
  type: CellChangeType;
  cellId: string;
  cellType: WorkbookCell["type"];
  label?: string;
}

/** Ids of `a` that survive in `b` in the same relative order (LCS of id sequences). */
function lcsIds(a: string[], b: string[]): Set<string> {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const keep = new Set<string>();
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      keep.add(a[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return keep;
}

/**
 * Compares two cell arrays (a pinned version vs the live/target workbook) and
 * returns the design-level changes: cells added, removed, edited, or reordered.
 * Output cells and runtime state are ignored.
 */
export function diffCells(oldCells: WorkbookCell[], newCells: WorkbookCell[]): CellChange[] {
  const oldD = oldCells.filter((c) => c.type !== "output");
  const newD = newCells.filter((c) => c.type !== "output");
  const oldById = new Map(oldD.map((c) => [c.id, c]));
  const newById = new Map(newD.map((c) => [c.id, c]));

  const changes: CellChange[] = [];

  for (const c of oldD) {
    if (!newById.has(c.id)) {
      changes.push({ type: "removed", cellId: c.id, cellType: c.type, label: labelOf(c) });
    }
  }

  const changedOrAdded = new Set<string>();
  for (const c of newD) {
    const prev = oldById.get(c.id);
    if (!prev) {
      changes.push({ type: "added", cellId: c.id, cellType: c.type, label: labelOf(c) });
      changedOrAdded.add(c.id);
    } else if (designCell(prev) !== designCell(c)) {
      changes.push({ type: "changed", cellId: c.id, cellType: c.type, label: labelOf(c) });
      changedOrAdded.add(c.id);
    }
  }

  // Reordering: among cells present on both sides, those off the LCS moved.
  const commonOldIds = oldD.filter((c) => newById.has(c.id)).map((c) => c.id);
  const commonNewIds = newD.filter((c) => oldById.has(c.id)).map((c) => c.id);
  const stable = lcsIds(commonOldIds, commonNewIds);
  for (const c of newD) {
    if (!oldById.has(c.id)) continue;
    if (changedOrAdded.has(c.id)) continue;
    if (!stable.has(c.id)) {
      changes.push({ type: "moved", cellId: c.id, cellType: c.type, label: labelOf(c) });
    }
  }

  return changes;
}
