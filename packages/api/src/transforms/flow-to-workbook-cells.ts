import type { z } from "zod";

import type {
  zExperimentFlowEdge,
  zExperimentFlowNode,
} from "../domains/experiment/experiment.schema";
import type {
  BranchCondition,
  BranchPath,
  QuestionCell,
  WorkbookCell,
} from "../domains/workbook/workbook-cells.schema";
import { dynamicCommandNodeLabel } from "./cells-to-flow";
import { sequentialChainOrder } from "./flow-graph-topology";

type FlowNode = z.infer<typeof zExperimentFlowNode>;
type FlowEdge = z.infer<typeof zExperimentFlowEdge>;

/**
 * Reverse-conversion order: the authored ordinary chain first, then every
 * remaining (disconnected or goto-only) node in deterministic original
 * node-array order. No schema-valid node is dropped, so a materialized
 * workbook keeps every cell. Chain computation is shared with the validator
 * via `sequentialChainOrder`, so the two cannot drift.
 */
export function orderFlowNodes(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  if (nodes.length === 0) return [];

  const chain = sequentialChainOrder(nodes, edges);
  const visited = new Set(chain.map((n) => n.id));
  const rest = nodes.filter((n) => !visited.has(n.id));
  return [...chain, ...rest];
}

function nodeToCell(node: FlowNode, edges: FlowEdge[]): WorkbookCell | null {
  const content = node.content as Record<string, unknown>;

  switch (node.type) {
    case "measurement": {
      // Reject a mixed carrier (both a protocol id and a command) rather than
      // silently picking one and dropping the other. Strict schemas prevent
      // persistence; this guards objects passed straight into conversion.
      const hasProtocol = typeof content.protocolId === "string" && content.protocolId.length > 0;
      const hasCommand = content.command != null;
      if (hasProtocol && hasCommand) return null;

      // Recognize the ref carrier first so a ref node is never retyped.
      const command = content.command as
        | { kind?: string; ref?: { sourceCellId?: unknown; field?: unknown }; content?: unknown }
        | undefined;
      if (command?.kind === "ref" && command.ref && typeof command.ref.sourceCellId === "string") {
        const sourceCellId = command.ref.sourceCellId;
        const field = typeof command.ref.field === "string" ? command.ref.field : "";
        const derivedLabel = dynamicCommandNodeLabel({ field });
        return {
          id: node.id,
          type: "command",
          isCollapsed: false,
          payload: {
            kind: "ref",
            ref: { sourceCellId, field },
            // Keep an authored name; omit a name equal to the derived label.
            ...(node.name && node.name !== derivedLabel ? { name: node.name } : {}),
          },
        };
      }
      const inline = command as { format?: string; content?: string } | undefined;
      if (inline && typeof inline.content === "string") {
        return {
          id: node.id,
          type: "command",
          isCollapsed: false,
          payload: {
            format: (inline.format as "string" | "json" | "yaml" | undefined) ?? "string",
            content: inline.content,
            // Drop the auto-derived name so a round-trip doesn't fabricate one.
            ...(node.name && node.name !== inline.content ? { name: node.name } : {}),
          },
        };
      }
      return {
        id: node.id,
        type: "protocol",
        isCollapsed: false,
        payload: {
          protocolId: content.protocolId as string,
          version: 1,
          name: node.name,
        },
      };
    }

    case "analysis":
      return {
        id: node.id,
        type: "macro",
        isCollapsed: false,
        payload: {
          macroId: content.macroId as string,
          language: "javascript",
          name: node.name,
        },
      };

    case "question":
      return {
        id: node.id,
        type: "question",
        isCollapsed: false,
        isAnswered: false,
        // Fallback keeps the schema invariant that `name` is required when source flow node had a blank name.
        name: node.name || `question_${node.id.slice(0, 8)}`,
        question: content as QuestionCell["question"],
      };

    case "instruction":
      return {
        id: node.id,
        type: "markdown",
        isCollapsed: false,
        content: typeof content.text === "string" ? content.text : "",
      };

    case "branch": {
      // Reconstruct the branch cell from the node's path structure. Goto targets
      // come from the carried `gotoCellId`, falling back to the outgoing goto
      // edge whose `sourceHandle` identifies the path (older graphs are
      // edge-only). Conditions are carried on the node.
      const rawPaths = Array.isArray(content.paths)
        ? (content.paths as Record<string, unknown>[])
        : [];
      const paths: BranchPath[] = rawPaths.map((p) => {
        const id = typeof p.id === "string" ? p.id : "";
        const gotoFromEdge = edges.find(
          (e) => e.source === node.id && e.sourceHandle === id,
        )?.target;
        const gotoCellId = typeof p.gotoCellId === "string" ? p.gotoCellId : gotoFromEdge;
        return {
          id,
          label: typeof p.label === "string" ? p.label : "",
          color: typeof p.color === "string" ? p.color : "",
          conditions: Array.isArray(p.conditions) ? (p.conditions as BranchCondition[]) : [],
          ...(gotoCellId ? { gotoCellId } : {}),
        };
      });
      if (paths.length === 0) return null;
      return {
        id: node.id,
        type: "branch",
        isCollapsed: false,
        paths,
        ...(typeof content.defaultPathId === "string"
          ? { defaultPathId: content.defaultPathId }
          : {}),
      };
    }

    default:
      return null;
  }
}

export function flowNodesToWorkbookCells(nodes: FlowNode[], edges: FlowEdge[]): WorkbookCell[] {
  const ordered = orderFlowNodes(nodes, edges);
  const cells: WorkbookCell[] = [];

  for (const node of ordered) {
    try {
      const cell = nodeToCell(node, edges);
      if (cell) cells.push(cell);
    } catch {
      continue;
    }
  }

  return cells;
}
