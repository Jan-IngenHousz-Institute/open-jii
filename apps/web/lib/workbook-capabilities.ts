import {
  assertWorkbookCellsSupported,
  WORKBOOK_PARALLEL_CAPABILITY,
} from "@repo/api/domains/workbook/workbook-capabilities";
import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

export const WEB_WORKBOOK_CAPABILITIES = new Set([WORKBOOK_PARALLEL_CAPABILITY]);

/** Applied as a query selector so persisted/cached responses are checked too. */
export function guardWebWorkbookContent<T extends { cells: WorkbookCell[] }>(value: T): T {
  assertWorkbookCellsSupported(value.cells, WEB_WORKBOOK_CAPABILITIES);
  return value;
}
