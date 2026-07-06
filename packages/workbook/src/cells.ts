import type { WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";

export type CommandFormat = "string" | "json" | "yaml";

// Structural shim for the inline command cell; @repo/api on main has no
// command cell yet. Replace with @repo/api's zCommandCell once OJD-1556 lands.
export interface CommandCellLike {
  id: string;
  type: "command";
  isCollapsed?: boolean;
  payload: { format: CommandFormat; content: string; name?: string };
}

export type RunnerCell = WorkbookCell | CommandCellLike;

export function isCommandCell(cell: RunnerCell): cell is CommandCellLike {
  return cell.type === "command";
}
