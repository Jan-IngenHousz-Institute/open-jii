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
        cell.payload.name?.trim()
          ? cell.payload.name
          : `Protocol ${cell.payload.protocolId.slice(0, 8)}`,
        { protocolId: cell.payload.protocolId },
        isStart,
      );

    case "command": {
      // Inline command rides the existing measurement node so old apps drop it
      // cleanly (unknown content) rather than choking on a new node type.
      const source = cell.payload.name?.trim() ? cell.payload.name : cell.payload.content;
      const label = source
        .replace(/[\r\n]+/g, " ")
        .trim()
        .slice(0, 64);
      return makeNode(
        cell.id,
        "measurement",
        // Never empty: zFlowNode.name requires a min length of 1.
        label.length > 0 ? label : "Command",
        { command: { format: cell.payload.format, content: cell.payload.content } },
        isStart,
      );
    }

    case "macro":
      return makeNode(
        cell.id,
        "analysis",
        cell.payload.name?.trim() ? cell.payload.name : `Macro ${cell.payload.macroId.slice(0, 8)}`,
        { macroId: cell.payload.macroId },
        isStart,
      );

    case "question":
      // Cell `name` is the column-key label; data pipeline canonicalises it into a column key downstream.
      return makeNode(cell.id, "question", cell.name, cell.question, isStart);

    case "markdown":
      // Blank markdown has no instruction to give; an empty name/text node
      // violates the flow contract and 500s every subsequent flow read.
      if (cell.content.trim().length === 0) {
        return null;
      }
      return makeNode(
        cell.id,
        "instruction",
        cell.content.slice(0, 64),
        { text: cell.content },
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
        },
        isStart,
      );

    case "output":
      return null;

    default:
      return null;
  }
}

// A goto may point at a cell that emits no node (blank markdown, output cell).
// Redirect it to the next emitted node in cell order, or drop the edge when
// nothing follows.
function resolveGotoTarget(
  cells: WorkbookCell[],
  emittedIds: Set<string>,
  targetCellId: string,
): string | null {
  if (emittedIds.has(targetCellId)) {
    return targetCellId;
  }

  const targetIndex = cells.findIndex((cell) => cell.id === targetCellId);
  if (targetIndex === -1) {
    return null;
  }

  for (let i = targetIndex + 1; i < cells.length; i++) {
    if (emittedIds.has(cells[i].id)) {
      return cells[i].id;
    }
  }
  return null;
}

interface PendingGotoEdge {
  source: string;
  targetCellId: string;
  label: string;
  pathId: string;
}

export function cellsToFlowGraph(cells: WorkbookCell[]): DerivedFlowGraph {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  const emittedIds = new Set<string>();
  const gotoEdges: PendingGotoEdge[] = [];

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
    emittedIds.add(node.id);
    firstId ??= node.id;

    if (previousId) {
      edges.push(makeEdge(previousId, node.id));
    }

    if (cell.type === "branch") {
      for (const path of cell.paths) {
        if (path.gotoCellId) {
          gotoEdges.push({
            source: cell.id,
            targetCellId: path.gotoCellId,
            label: path.label,
            pathId: path.id,
          });
        }
      }
    }

    previousId = node.id;
  }

  for (const goto of gotoEdges) {
    const target = resolveGotoTarget(cells, emittedIds, goto.targetCellId);
    if (target) {
      edges.push(makeEdge(goto.source, target, goto.label, goto.pathId));
    }
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
