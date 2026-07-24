import type { OutputCell, WorkbookCell } from "../domains/workbook/workbook-cells.schema";

export interface DuplicateOutputCellsFailure {
  code: "COMMAND_OUTPUT_DUPLICATE";
  sourceCellId: string;
  outputCellIds: string[];
}

export type OutputCellLookupResult =
  | { ok: true; outputCell: OutputCell | undefined }
  | { ok: false; error: DuplicateOutputCellsFailure };

/**
 * Find the display output owned by a producer. Output id or adjacency is never
 * used as ownership; only `producedBy === sourceCellId` is authoritative.
 */
export function findOutputCellByProducer(
  cells: WorkbookCell[],
  sourceCellId: string,
): OutputCellLookupResult {
  const matches = cells.filter(
    (cell): cell is OutputCell => cell.type === "output" && cell.producedBy === sourceCellId,
  );

  if (matches.length > 1) {
    return {
      ok: false,
      error: {
        code: "COMMAND_OUTPUT_DUPLICATE",
        sourceCellId,
        outputCellIds: matches.map((cell) => cell.id),
      },
    };
  }

  return { ok: true, outputCell: matches[0] };
}
