import type { ExperimentFlowGraph } from "../experiment/experiment.schema";
import type { WorkbookCell } from "./workbook-cells.schema";

/** Comma-separated capability tokens understood by workbook content egresses. */
export const WORKBOOK_CAPABILITIES_HEADER = "x-workbook-capabilities";

/** The client can parse, render and execute shallow parallel containers. */
export const WORKBOOK_PARALLEL_CAPABILITY = "workbook-parallel-v1";

export type ContainerFreeWorkbookCell = Exclude<WorkbookCell, { type: "parallel" }>;
export type ContainerFreeFlowNode = Omit<ExperimentFlowGraph["nodes"][number], "type"> & {
  type: Exclude<ExperimentFlowGraph["nodes"][number]["type"], "parallel">;
};
export type ContainerFreeExperimentFlowGraph = Omit<ExperimentFlowGraph, "nodes"> & {
  nodes: ContainerFreeFlowNode[];
};

export class UnsupportedWorkbookCapabilityError extends Error {
  constructor(public readonly requiredCapability: string) {
    super(`Workbook content requires capability ${requiredCapability}`);
    this.name = "UnsupportedWorkbookCapabilityError";
  }
}

export function parseWorkbookCapabilities(
  value: string | readonly string[] | undefined,
): Set<string> {
  const values = value === undefined ? [] : typeof value === "string" ? [value] : value;
  return new Set(
    values
      .flatMap((entry) => entry.split(","))
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

export function hasParallelWorkbookCells(cells: readonly WorkbookCell[]): boolean {
  return cells.some((cell) => cell.type === "parallel");
}

export function hasParallelFlowGraph(graph: ExperimentFlowGraph): boolean {
  return graph.nodes.some((node) => node.type === "parallel");
}

export function assertWorkbookCellsSupported(
  cells: readonly WorkbookCell[],
  capabilities: ReadonlySet<string>,
): void {
  if (hasParallelWorkbookCells(cells) && !capabilities.has(WORKBOOK_PARALLEL_CAPABILITY)) {
    throw new UnsupportedWorkbookCapabilityError(WORKBOOK_PARALLEL_CAPABILITY);
  }
}

export function assertFlowGraphSupported(
  graph: ExperimentFlowGraph,
  capabilities: ReadonlySet<string>,
): void {
  if (hasParallelFlowGraph(graph) && !capabilities.has(WORKBOOK_PARALLEL_CAPABILITY)) {
    throw new UnsupportedWorkbookCapabilityError(WORKBOOK_PARALLEL_CAPABILITY);
  }
}

/** Mobile's explicit fail-closed guard; also narrows away the unsupported cell variant. */
export function assertContainerFreeWorkbookCells(
  cells: WorkbookCell[],
): asserts cells is ContainerFreeWorkbookCell[] {
  if (hasParallelWorkbookCells(cells)) {
    throw new UnsupportedWorkbookCapabilityError(WORKBOOK_PARALLEL_CAPABILITY);
  }
}

/** Narrows a projected graph only after the same content check used at server egress. */
export function assertContainerFreeFlowGraph(
  graph: ExperimentFlowGraph,
): asserts graph is ContainerFreeExperimentFlowGraph {
  if (hasParallelFlowGraph(graph)) {
    throw new UnsupportedWorkbookCapabilityError(WORKBOOK_PARALLEL_CAPABILITY);
  }
}
