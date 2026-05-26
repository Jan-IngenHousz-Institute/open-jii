import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";

// Protocol/macro ids referenced by a workbook version's cells, for offline
// prefetch (workbook equivalent of walking measurement/analysis flow nodes).
export function extractAssetIdsFromCells(cells: WorkbookCell[]): {
  protocolIds: string[];
  macroIds: string[];
} {
  const protocolIds: string[] = [];
  const macroIds: string[] = [];
  for (const cell of cells) {
    if (cell.type === "protocol" && cell.payload.protocolId) {
      protocolIds.push(cell.payload.protocolId);
    } else if (cell.type === "macro" && cell.payload.macroId) {
      macroIds.push(cell.payload.macroId);
    }
  }
  return { protocolIds, macroIds };
}
