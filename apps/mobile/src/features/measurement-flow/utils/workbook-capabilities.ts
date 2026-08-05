import type { ExperimentFlowGraph } from "@repo/api/domains/experiment/experiment.schema";
import {
  assertContainerFreeFlowGraph,
  assertContainerFreeWorkbookCells,
  hasParallelWorkbookCells,
} from "@repo/api/domains/workbook/workbook-capabilities";
import type { ContainerFreeWorkbookCell } from "@repo/api/domains/workbook/workbook-capabilities";
import type { ContainerFreeExperimentFlowGraph } from "@repo/api/domains/workbook/workbook-capabilities";
import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

export function guardMobileWorkbookContent<T extends { cells: WorkbookCell[] }>(
  value: T,
): Omit<T, "cells"> & { cells: ContainerFreeWorkbookCell[] } {
  assertContainerFreeWorkbookCells(value.cells);
  return value as Omit<T, "cells"> & { cells: ContainerFreeWorkbookCell[] };
}

export function guardMobileFlowContent<T extends { graph: ExperimentFlowGraph }>(
  value: T,
): Omit<T, "graph"> & { graph: ContainerFreeExperimentFlowGraph } {
  assertContainerFreeFlowGraph(value.graph);
  return value as Omit<T, "graph"> & { graph: ContainerFreeExperimentFlowGraph };
}

export function hasUnsupportedMobileWorkbookContent(value: {
  cells: WorkbookCell[];
  flowNodes: readonly { type: string }[];
}): boolean {
  return (
    hasParallelWorkbookCells(value.cells) ||
    value.flowNodes.some((node) => node.type === "parallel")
  );
}
