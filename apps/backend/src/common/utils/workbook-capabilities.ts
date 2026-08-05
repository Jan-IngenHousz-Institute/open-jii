import { ORPCError } from "@orpc/nest";

import type { ExperimentFlowGraph } from "@repo/api/domains/experiment/experiment.schema";
import {
  assertFlowGraphSupported,
  assertWorkbookCellsSupported,
  parseWorkbookCapabilities,
  UnsupportedWorkbookCapabilityError,
} from "@repo/api/domains/workbook/workbook-capabilities";
import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

function upgradeRequired(): never {
  throw new ORPCError("UPGRADE_REQUIRED", {
    status: 426,
    message: "This workbook requires a newer client",
  });
}

export function requireWorkbookCellsCapability(
  cells: readonly WorkbookCell[],
  capabilityHeader: string | readonly string[] | undefined,
): void {
  try {
    assertWorkbookCellsSupported(cells, parseWorkbookCapabilities(capabilityHeader));
  } catch (error) {
    if (!(error instanceof UnsupportedWorkbookCapabilityError)) throw error;
    upgradeRequired();
  }
}

export function requireFlowGraphCapability(
  graph: ExperimentFlowGraph,
  capabilityHeader: string | readonly string[] | undefined,
): void {
  try {
    assertFlowGraphSupported(graph, parseWorkbookCapabilities(capabilityHeader));
  } catch (error) {
    if (!(error instanceof UnsupportedWorkbookCapabilityError)) throw error;
    upgradeRequired();
  }
}
