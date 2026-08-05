import type { ExperimentFlowGraph } from "@repo/api/domains/experiment/experiment.schema";
import {
  assertFlowGraphSupported,
  assertWorkbookCellsSupported,
  WORKBOOK_PARALLEL_CAPABILITY,
} from "@repo/api/domains/workbook/workbook-capabilities";
import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

export const MOBILE_WORKBOOK_CAPABILITIES = new Set([WORKBOOK_PARALLEL_CAPABILITY]);

export function guardMobileWorkbookContent<T extends { cells: WorkbookCell[] }>(value: T): T {
  assertWorkbookCellsSupported(value.cells, MOBILE_WORKBOOK_CAPABILITIES);
  return value;
}

export function guardMobileFlowContent<T extends { graph: ExperimentFlowGraph }>(value: T): T {
  assertFlowGraphSupported(value.graph, MOBILE_WORKBOOK_CAPABILITIES);
  return value;
}
