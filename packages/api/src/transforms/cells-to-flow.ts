import type { z } from "zod";

import type {
  zExperimentFlowEdge,
  zExperimentFlowNode,
} from "../domains/experiment/experiment.schema";
import type { WorkbookCell } from "../domains/workbook/workbook-cells.schema";

type FlowNode = z.infer<typeof zExperimentFlowNode>;
type FlowEdge = z.infer<typeof zExperimentFlowEdge>;
type Content = FlowNode["content"];

export interface DerivedFlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

function makeEdge(source: string, target: string, label?: string, sourceHandle?: string): FlowEdge {
  const id = sourceHandle ? `e-${source}-${sourceHandle}-${target}` : `e-${source}-${target}`;
  return {
    id,
    source,
    target,
    label: label ?? null,
    sourceHandle: sourceHandle ?? null,
  };
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
      // Cell `name` is the column-key label; data pipeline canonicalises it into a column key downstream.
      return makeNode(cell.id, "question", cell.name, cell.question as Content, isStart);

    case "markdown":
      return makeNode(
        cell.id,
        "instruction",
        cell.content.slice(0, 64),
        { text: cell.content } as Content,
        isStart,
      );

    case "branch":
      return makeNode(
        cell.id,
        "branch",
        "Branch",
        {
          paths: cell.paths.map((p) => ({ id: p.id, label: p.label, color: p.color })),
          defaultPathId: cell.defaultPathId,
        } as Content,
        isStart,
      );

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

    if (cell.type === "branch") {
      for (const path of cell.paths) {
        if (path.gotoCellId) {
          edges.push(makeEdge(cell.id, path.gotoCellId, path.label, path.id));
        }
      }
    }

    previousId = node.id;
  }

  const NODE_SPACING = 250;
  const Y_CENTER = 240;
  const totalWidth = (nodes.length - 1) * NODE_SPACING;
  const startX = -totalWidth / 2;
  for (let i = 0; i < nodes.length; i++) {
    nodes[i].position = { x: startX + i * NODE_SPACING, y: Y_CENTER };
  }

  return { nodes, edges };
}
