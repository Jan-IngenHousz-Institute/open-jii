import { deriveMacroFilename } from "~/features/measurement-flow/utils/derive-macro-filename";
import type { FlowNode } from "~/shared/measurements/flow-node";

import type {
  MacroCell,
  ProtocolCell,
  WorkbookCell,
} from "@repo/api/domains/workbook/workbook-cells.schema";
import type { EntitySnapshots } from "@repo/api/domains/workbook/workbook-version.schema";
import { cellsToFlowGraph } from "@repo/api/transforms/cells-to-flow";
import { findWorkbookCell, walkWorkbookCells } from "@repo/api/transforms/workbook-cell-tree";

/**
 * Hydrates each measurement/analysis node with its protocol/macro (snapshot code
 * + cell name), resolved once so the scan and macro upload read off the node.
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
      const found = findWorkbookCell(cells, node.id)?.cell;
      const cell =
        found?.type === "protocol"
          ? found
          : walkWorkbookCells(cells)
              .map(({ cell }) => cell)
              .find(
                (candidate): candidate is ProtocolCell =>
                  candidate.type === "protocol" && candidate.payload.protocolId === id,
              );
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
      const found = findWorkbookCell(cells, node.id)?.cell;
      const cell =
        found?.type === "macro"
          ? found
          : walkWorkbookCells(cells)
              .map(({ cell }) => cell)
              .find(
                (candidate): candidate is MacroCell =>
                  candidate.type === "macro" && candidate.payload.macroId === id,
              );
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

    if (node.type === "parallel") {
      const container = findWorkbookCell(cells, node.id)?.cell;
      if (container?.type !== "parallel") return node;
      return {
        ...node,
        content: {
          ...node.content,
          laneNodes: Object.fromEntries(
            container.lanes.map((lane) => {
              const graph = cellsToFlowGraph(lane.body);
              return [lane.id, hydrateFlowNodes(graph.nodes, cells, snapshots)] as const;
            }),
          ),
        },
      };
    }

    return node;
  });
}
