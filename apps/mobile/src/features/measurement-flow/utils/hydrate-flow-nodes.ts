import { deriveMacroFilename } from "~/features/measurement-flow/utils/derive-macro-filename";
import type { FlowNode } from "~/shared/measurements/flow-node";

import type {
  MacroCell,
  ProtocolCell,
  WorkbookCell,
} from "@repo/api/domains/workbook/workbook-cells.schema";
import type { EntitySnapshots } from "@repo/api/domains/workbook/workbook-version.schema";

/**
 * Hydrates each measurement/analysis node with its protocol/macro (snapshot code
 * + cell name), resolved once so the scan and macro upload read off the node.
 * Nodes must come from cellsToFlowGraph over the supplied cells, which guarantees
 * each node id is the id of its exact producer workbook cell.
 */
export function hydrateFlowNodes(
  nodes: FlowNode[],
  cells: WorkbookCell[],
  snapshots?: EntitySnapshots,
): FlowNode[] {
  return nodes.map((node) => {
    if (node.type === "measurement" && node.content?.protocolId) {
      const id = node.content.protocolId as string;
      const snapshot = snapshots?.protocols[id];
      const cell = cells.find((c): c is ProtocolCell => c.type === "protocol" && c.id === node.id);
      return {
        ...node,
        content: {
          ...node.content,
          protocol: {
            code: (snapshot?.code ?? []) as Record<string, unknown>[],
            family: snapshot?.family,
            name: cell?.payload.name,
          },
        },
      };
    }

    if (node.type === "analysis" && node.content?.macroId) {
      const id = node.content.macroId as string;
      const cell = cells.find((c): c is MacroCell => c.type === "macro" && c.id === node.id);
      return {
        ...node,
        content: {
          ...node.content,
          macro: {
            id,
            name: cell?.payload.name ?? deriveMacroFilename(id),
            filename: deriveMacroFilename(id),
            language: cell?.payload.language ?? "",
            code: snapshots?.macros[id]?.code ?? "",
          },
        },
      };
    }

    return node;
  });
}
