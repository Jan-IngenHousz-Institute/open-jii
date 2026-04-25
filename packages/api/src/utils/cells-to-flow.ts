import type { z } from "zod";

import type { zFlowEdge, zFlowNode } from "../schemas/experiment.schema";
import type { WorkbookCell } from "../schemas/workbook-cells.schema";

type FlowNode = z.infer<typeof zFlowNode>;
type FlowEdge = z.infer<typeof zFlowEdge>;
type Content = FlowNode["content"];

export interface DerivedFlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

function makeEdge(source: string, target: string, label?: string): FlowEdge {
  return { id: `e-${source}-${target}`, source, target, label: label ?? null };
}

function makeNode(
  id: string,
  type: FlowNode["type"],
  name: string,
  content: Content,
  isStart: boolean,
): FlowNode {
  return { id, type, name, content, isStart };
}

function cellToNode(cell: WorkbookCell, isStart: boolean): FlowNode | null {
  switch (cell.type) {
    case "protocol":
      return makeNode(
        cell.id,
        "measurement",
        cell.payload.name ?? `Protocol ${cell.payload.protocolId.slice(0, 8)}`,
        { protocolId: cell.payload.protocolId } as Content,
        isStart,
      );

    case "macro":
      return makeNode(
        cell.id,
        "analysis",
        cell.payload.name ?? `Macro ${cell.payload.macroId.slice(0, 8)}`,
        { macroId: cell.payload.macroId } as Content,
        isStart,
      );

    case "question":
      return makeNode(cell.id, "question", cell.question.text, cell.question as Content, isStart);

    case "markdown":
      return makeNode(
        cell.id,
        "instruction",
        cell.content.slice(0, 64),
        { text: cell.content } as Content,
        isStart,
      );

    case "branch": {
      const labels = cell.paths.map((p) => p.label).join(" / ");
      return makeNode(cell.id, "instruction", "Branch", { text: labels } as Content, isStart);
    }

    case "output":
      return null;

    default:
      return null;
  }
}

export function cellsToFlowGraph(cells: WorkbookCell[]): DerivedFlowGraph {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  let previousId: string | null = null;
  let firstId: string | null = null;

  for (const cell of cells) {
    let node: FlowNode | null;
    try {
      node = cellToNode(cell, !firstId);
    } catch {
      continue;
    }
    if (!node) continue;

    nodes.push(node);
    firstId ??= node.id;

    if (previousId) {
      edges.push(makeEdge(previousId, node.id));
    }

    // Branch paths with gotoCellId create back-edges
    if (cell.type === "branch") {
      for (const path of cell.paths) {
        if (path.gotoCellId) {
          edges.push(makeEdge(cell.id, path.gotoCellId, path.label));
        }
      }
    }

    previousId = node.id;
  }

  // Assign horizontal positions so the graph renders as a left-to-right chain
  const NODE_SPACING = 250;
  const Y_CENTER = 240;
  const totalWidth = (nodes.length - 1) * NODE_SPACING;
  const startX = -totalWidth / 2;
  for (let i = 0; i < nodes.length; i++) {
    nodes[i].position = { x: startX + i * NODE_SPACING, y: Y_CENTER };
  }

  return { nodes, edges };
}
