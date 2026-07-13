import { deriveMacroFilename } from "~/features/measurement-flow/utils/derive-macro-filename";
import type { FlowNode } from "~/shared/measurements/flow-node";

import { isCommandReferencePayload } from "@repo/api/schemas/workbook-cells.schema";
import type { MacroCell, CommandCell, WorkbookCell } from "@repo/api/schemas/workbook-cells.schema";
import type { EntitySnapshots } from "@repo/api/schemas/workbook-version.schema";

/**
 * Hydrates each measurement/analysis node with its command/macro (snapshot code
 * + cell name), resolved once so the scan and macro upload read off the node.
 */
export function hydrateFlowNodes(
  nodes: FlowNode[],
  cells: WorkbookCell[],
  snapshots?: EntitySnapshots,
): FlowNode[] {
  return nodes.map((node) => {
    if (node.type === "measurement" && node.content?.commandId) {
      const id = node.content.commandId as string;
      const snapshot = snapshots?.commands[id];
      const cell = cells.find(
        (c): c is CommandCell =>
          c.type === "command" &&
          isCommandReferencePayload(c.payload) &&
          c.payload.commandId === id,
      );
      return {
        ...node,
        content: {
          ...node.content,
          resolved: {
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
