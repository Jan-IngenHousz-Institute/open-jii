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
 * a column, and listed as unplaced where it does not. A name given twice keeps its first row.
 */
export class PlotListPreview {
  readonly plots: readonly PlotListEntry[];
  readonly duplicateNames: readonly string[];

  constructor(rows: readonly MetadataRow[], mapping: PlotListMapping) {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
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
      const isPlaced = rowNumber !== null && column !== null;
      plots.push({
        identifier,
        row: isPlaced ? rowNumber : null,
        column: isPlaced ? column : null,
      });
    }

    this.plots = plots;
    this.duplicateNames = [...duplicates];
  }

  get placed(): readonly PlotListEntry[] {
    return this.plots.filter((plot) => plot.row !== null);
  }

  get unplaced(): readonly PlotListEntry[] {
    return this.plots.filter((plot) => plot.row === null);
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
