import { zExperimentFlowGraph } from "@repo/api/domains/experiment/experiment.schema";
import { zWorkbookCellArray } from "@repo/api/domains/workbook/workbook-cells.schema";
import { cellsToFlowGraph } from "@repo/api/transforms/cells-to-flow";

import { ErrorCodes } from "../../../common/utils/error-codes";
import type { Result } from "../../../common/utils/fp-utils";
import { success, failure, AppError } from "../../../common/utils/fp-utils";
import type { FlowMaterialization } from "../../core/models/flow.model";

export type { FlowMaterialization };

function materializationFailed(): AppError {
  // Never surface the raw cells/graph or parse detail.
  return AppError.internal(
    "Failed to materialize a valid flow graph from the workbook version",
    ErrorCodes.FLOW_MATERIALIZATION_FAILED,
  );
}

/**
 * Derive a flow graph from workbook version cells and validate it strictly
 * BEFORE any trusted persistence (attach/set/upgrade). Steps, all fail-closed:
 *
 * 1. Strict-parse the raw `unknown` cells with `zWorkbookCellArray` (a
 *    non-array, missing command payload, `ref: null`, mixed ref/static, or any
 *    invalid nested cell is rejected here).
 * 2. Convert only the parsed cells; any unexpected converter throw is caught.
 * 3. Strict-parse the derived graph with `zExperimentFlowGraph`.
 *
 * A failure returns FLOW_MATERIALIZATION_FAILED (no raw graph/detail) and the
 * caller performs no pointer/flow mutation.
 */
export function materializeFlowGraph(cells: unknown): Result<FlowMaterialization> {
  const parsedCells = zWorkbookCellArray.safeParse(cells);
  if (!parsedCells.success) return failure(materializationFailed());

  let graph: ReturnType<typeof cellsToFlowGraph>;
  try {
    graph = cellsToFlowGraph(parsedCells.data);
  } catch {
    return failure(materializationFailed());
  }

  // An empty workbook materializes to a node-less graph: represent it as "no
  // flow" so the binder deletes any existing row instead of storing a
  // schema-invalid zero-node graph.
  if (graph.nodes.length === 0) return success({ kind: "none" });

  const parsedGraph = zExperimentFlowGraph.safeParse(graph);
  if (!parsedGraph.success) return failure(materializationFailed());

  return success({ kind: "flow", graph: parsedGraph.data });
}
