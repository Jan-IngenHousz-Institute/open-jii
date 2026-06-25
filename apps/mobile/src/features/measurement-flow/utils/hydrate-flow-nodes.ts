import { deriveMacroFilename } from "~/features/measurement-flow/utils/derive-macro-filename";

import type {
  MacroCell,
  ProtocolCell,
  WorkbookCell,
} from "@repo/api/schemas/workbook-cells.schema";
import type { EntitySnapshots } from "@repo/api/schemas/workbook-version.schema";

import type { FlowNode } from "../screens/measurement-flow-screen/types";

/**
 * Hydrates each measurement/analysis node with the protocol/macro it needs,
 * resolved once from the workbook version: protocol code comes from the pinned
 * snapshot, macro filename is derived from its id (deriveMacroFilename), and
 * names come from the cell. The scan and macro upload then read straight off
 * the node, with no separate snapshot lookup. Every experiment is workbook
 * backed, so the snapshot is always present.
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
      const cell = cells.find(
        (c): c is ProtocolCell => c.type === "protocol" && c.payload.protocolId === id,
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
      const cell = cells.find(
        (c): c is MacroCell => c.type === "macro" && c.payload.macroId === id,
      );
      return {
        ...node,
        content: {
          ...node.content,
          macro: {
            id,
            // Cosmetic macro_name metadata; fall back to the filename.
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
