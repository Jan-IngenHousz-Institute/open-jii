import type { z } from "zod";

import type { zFlowEdge, zFlowNode } from "../schemas/experiment.schema";
import type { QuestionCell, WorkbookCell } from "../schemas/workbook-cells.schema";

type FlowNode = z.infer<typeof zFlowNode>;
type FlowEdge = z.infer<typeof zFlowEdge>;

export function orderFlowNodes(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  if (nodes.length === 0) return [];

  const idToNode = new Map<string, FlowNode>();
  for (const node of nodes) {
    idToNode.set(node.id, node);
  }

  const fromTo = new Map<string, string[]>();
  for (const edge of edges) {
    if (!fromTo.has(edge.source)) {
      fromTo.set(edge.source, []);
    }
    fromTo.get(edge.source)?.push(edge.target);
  }

  const startNode = nodes.find((n) => n.isStart) ?? nodes[0];
  const visited = new Set<string>();
  const ordered: FlowNode[] = [];

  let current: FlowNode | undefined = startNode;
  while (current && !visited.has(current.id)) {
    ordered.push(current);
    visited.add(current.id);

    const nextIds: string[] = fromTo.get(current.id) ?? [];
    const nextId: string | undefined = nextIds.find((id: string) => !visited.has(id));
    current = nextId ? idToNode.get(nextId) : undefined;
  }

  return ordered;
}

function nodeToCell(node: FlowNode): WorkbookCell | null {
  const content = node.content as Record<string, unknown>;

  switch (node.type) {
    case "measurement": {
      // A measurement node carries either a library command reference or an inline command.
      const inline = content.command as { format?: string; content?: string } | undefined;
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
        type: "command",
        isCollapsed: false,
        payload: {
          commandId: content.commandId as string,
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

    default:
      return null;
  }
}

export function flowNodesToWorkbookCells(nodes: FlowNode[], edges: FlowEdge[]): WorkbookCell[] {
  const ordered = orderFlowNodes(nodes, edges);
  const cells: WorkbookCell[] = [];

  for (const node of ordered) {
    try {
      const cell = nodeToCell(node);
      if (cell) cells.push(cell);
    } catch {
      continue;
    }
  }

  return cells;
}
