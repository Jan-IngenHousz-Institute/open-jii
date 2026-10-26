import type { MetadataRow } from "@/components/metadata-table/types";

export interface PlotListMapping {
  plotColumnId: string;
  rowColumnId: string | null;
  columnColumnId: string | null;
}

export interface PlotListEntry {
  identifier: string;
  row: number | null;
  column: number | null;
  /** The position the sheet gave, which an earlier row took first, and the plot that took it. */
  clash?: { row: number; column: number; keptBy: string };
}

/** A row given as a number, or as letters the way the grid labels rows (A, B, AA). */
function parseRow(value: unknown): number | null {
  const text =
    typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (/^\d+$/.test(text)) {
    return Number(text) > 0 ? Number(text) : null;
  }
  if (/^[a-z]+$/i.test(text)) {
    return text
      .toUpperCase()
      .split("")
      .reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0);
  }
  return null;
}

function parseColumn(value: unknown): number | null {
  const text =
    typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  return /^\d+$/.test(text) && Number(text) > 0 ? Number(text) : null;
}

/**
 * What a pasted plot list would create: one plot per named row, placed where it gives a row and
 * a column, and listed as unplaced where it does not. A name given twice keeps its first row, and
 * a position given twice goes to the first row naming it, so the later plot is unplaced.
 */
export class PlotListPreview {
  readonly plots: readonly PlotListEntry[];
  readonly duplicateNames: readonly string[];

  constructor(rows: readonly MetadataRow[], mapping: PlotListMapping) {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    const positions = new Map<string, string>();
    const plots: PlotListEntry[] = [];

    for (const row of rows) {
      const raw = row[mapping.plotColumnId];
      const identifier =
        typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
      if (identifier === "") {
        continue;
      }
      if (seen.has(identifier)) {
        duplicates.add(identifier);
        continue;
      }
      seen.add(identifier);

      const rowNumber = mapping.rowColumnId === null ? null : parseRow(row[mapping.rowColumnId]);
      const column =
        mapping.columnColumnId === null ? null : parseColumn(row[mapping.columnColumnId]);
      if (rowNumber === null || column === null) {
        plots.push({ identifier, row: null, column: null });
        continue;
      }

      const position = `${rowNumber}:${column}`;
      const keptBy = positions.get(position);
      if (keptBy !== undefined) {
        plots.push({
          identifier,
          row: null,
          column: null,
          clash: { row: rowNumber, column, keptBy },
        });
        continue;
      }
      positions.set(position, identifier);
      plots.push({ identifier, row: rowNumber, column });
    }

    this.plots = plots;
    this.duplicateNames = [...duplicates];
  }

  get placed(): readonly PlotListEntry[] {
    return this.plots.filter((plot) => plot.row !== null);
  }

  /** Plots the sheet gave no row and column. */
  get withoutPosition(): readonly PlotListEntry[] {
    return this.plots.filter((plot) => plot.row === null && plot.clash === undefined);
  }

  /** Plots whose position an earlier row took. */
  get clashing(): readonly PlotListEntry[] {
    return this.plots.filter((plot) => plot.clash !== undefined);
  }

  /** The grid the placed plots span, from row 1 and column 1. */
  get size(): { rows: number; columns: number } {
    return {
      rows: Math.max(0, ...this.placed.map((plot) => plot.row ?? 0)),
      columns: Math.max(0, ...this.placed.map((plot) => plot.column ?? 0)),
    };
  }

  get gapCount(): number {
    const { rows, columns } = this.size;
    return rows * columns - this.placed.length;
  }
}
