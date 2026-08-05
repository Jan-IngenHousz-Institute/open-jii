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

function makeEdge(
  source: string,
  target: string,
  kind: "sequence" | "branch",
  label?: string,
  sourceHandle?: string,
): FlowEdge {
  const id = sourceHandle ? `e-${source}-${sourceHandle}-${target}` : `e-${source}-${target}`;
  return {
    id,
    source,
    target,
    label: label ?? null,
    sourceHandle: sourceHandle ?? null,
    data: { kind },
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

function safeNodeName(value: string | undefined, fallback: string): string {
  const singleLine = value?.replace(/[\r\n]+/g, " ").trim() ?? "";
  return (singleLine || fallback).slice(0, 64);
}

/**
 * Derive the schema-safe canvas label for a cell. `rawName` lets the live
 * editor project an unsaved title through the exact same rule as initial load.
 */
export function deriveFlowNodeName(cell: WorkbookCell, rawName?: string): string {
  switch (cell.type) {
    case "protocol":
      return safeNodeName(
        rawName ?? cell.payload.name,
        `Protocol ${cell.payload.protocolId.slice(0, 8)}`,
      );
    case "command": {
      const commandName = rawName ?? cell.payload.name;
      return safeNodeName(commandName?.trim() ? commandName : cell.payload.content, "Command");
    }
    case "macro":
      return safeNodeName(
        rawName ?? cell.payload.name,
        `Macro ${cell.payload.macroId.slice(0, 8)}`,
      );
    case "question":
      return safeNodeName(rawName ?? cell.name, "Question");
    case "markdown":
      return safeNodeName(rawName ?? cell.content, "Instruction");
    case "branch":
      return "Branch";
    case "output":
      return "Output";
    case "parallel":
      return safeNodeName(rawName ?? cell.name, "Parallel");
  }
}

function cellToNode(cell: WorkbookCell, isStart: boolean): FlowNode | null {
  switch (cell.type) {
    case "protocol":
      return makeNode(
        cell.id,
        "measurement",
        deriveFlowNodeName(cell),
        { protocolId: cell.payload.protocolId },
        isStart,
      );

    case "command": {
      // Inline command rides the existing measurement node so old apps drop it
      // cleanly (unknown content) rather than choking on a new node type.
      return makeNode(
        cell.id,
        "measurement",
        deriveFlowNodeName(cell),
        { command: { format: cell.payload.format, content: cell.payload.content } },
        isStart,
      );
    }

    case "macro":
      return makeNode(
        cell.id,
        "analysis",
        deriveFlowNodeName(cell),
        { macroId: cell.payload.macroId },
        isStart,
      );

    case "question":
      // Cell `name` is the column-key label; data pipeline canonicalises it into a column key downstream.
      return makeNode(cell.id, "question", deriveFlowNodeName(cell), cell.question, isStart);

    case "markdown":
      return makeNode(
        cell.id,
        "instruction",
        deriveFlowNodeName(cell),
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

    case "parallel":
      return makeNode(
        cell.id,
        "parallel",
        deriveFlowNodeName(cell),
        {
          name: cell.name,
          defaultLaneId: cell.defaultLaneId,
          lanes: cell.lanes,
        },
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
      edges.push(makeEdge(previousId, node.id, "sequence"));
    }

    if (cell.type === "branch") {
      for (const path of cell.paths) {
        if (path.gotoCellId) {
          edges.push(makeEdge(cell.id, path.gotoCellId, "branch", path.label, path.id));
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
