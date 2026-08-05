import type { CommandCell, WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

export type CommandFormat = CommandCell["payload"]["format"];

export type RunnerCell = WorkbookCell;

export function isCommandCell(cell: RunnerCell): cell is CommandCell {
  return cell.type === "command";
}
