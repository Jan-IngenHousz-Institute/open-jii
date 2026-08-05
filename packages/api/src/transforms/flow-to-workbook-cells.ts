import type { z } from "zod";

import type {
  zExperimentFlowEdge,
  zExperimentFlowNode,
} from "../domains/experiment/experiment.schema";
import type {
  BranchCell,
  BranchPath,
  QuestionCell,
  WorkbookCell,
} from "../domains/workbook/workbook-cells.schema";

type FlowNode = z.infer<typeof zExperimentFlowNode>;
type FlowEdge = z.infer<typeof zExperimentFlowEdge>;

export type FlowEdgeKind = "sequence" | "branch";

/**
 * Old persisted flow graphs predate the discriminator. Keep reading them by
 * using the only distinction they encoded, while every newly projected graph
 * writes an explicit kind.
 */
export function getFlowEdgeKind(edge: FlowEdge): FlowEdgeKind {
  return edge.data?.kind ?? (edge.sourceHandle ? "branch" : "sequence");
}

/**
 * Validate and walk the single sequence chain that defines workbook order.
 * Branch edges are references and deliberately do not participate.
 */
export function orderFlowNodes(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  if (nodes.length === 0) return [];

  const idToNode = new Map<string, FlowNode>();
  for (const node of nodes) {
    if (idToNode.has(node.id)) {
      throw new Error(`Duplicate flow node id "${node.id}".`);
    }
    idToNode.set(node.id, node);
  }

  const starts = nodes.filter((node) => node.isStart);
  if (starts.length !== 1) {
    throw new Error("Exactly one start node is required.");
  }

  const nextById = new Map<string, string>();
  const previousById = new Map<string, string>();
  const sequenceEdges = edges.filter((edge) => getFlowEdgeKind(edge) === "sequence");

  for (const edge of sequenceEdges) {
    if (!idToNode.has(edge.source) || !idToNode.has(edge.target)) {
      throw new Error(`Sequence edge "${edge.id}" references a missing node.`);
    }
    if (nextById.has(edge.source)) {
      throw new Error(`Node "${edge.source}" has more than one sequence successor.`);
    }
    if (previousById.has(edge.target)) {
      throw new Error(`Node "${edge.target}" has more than one sequence predecessor.`);
    }
    nextById.set(edge.source, edge.target);
    previousById.set(edge.target, edge.source);
  }

  if (sequenceEdges.length !== nodes.length - 1) {
    throw new Error("Sequence edges must form one chain covering every node exactly once.");
  }

  const startNode = starts[0];
  if (previousById.has(startNode.id)) {
    throw new Error("The start node cannot have a sequence predecessor.");
  }

  const ordered: FlowNode[] = [];
  const visited = new Set<string>();
  let current: FlowNode | undefined = startNode;
  while (current) {
    if (visited.has(current.id)) {
      throw new Error("Sequence edges must be acyclic.");
    }
    ordered.push(current);
    visited.add(current.id);
    const nextId = nextById.get(current.id);
    current = nextId ? idToNode.get(nextId) : undefined;
  }

  if (ordered.length !== nodes.length) {
    throw new Error("Sequence edges must form one chain covering every node exactly once.");
  }

  return ordered;
}

function nodeToCell(node: FlowNode): WorkbookCell | null {
  const content = node.content as Record<string, unknown>;

  switch (node.type) {
    case "measurement": {
      const inline = content.command as { format?: string; content?: string } | undefined;
      if (inline && typeof inline.content === "string") {
        return {
          id: node.id,
          type: "command",
          isCollapsed: false,
          payload: {
            format: (inline.format as "string" | "json" | "yaml" | undefined) ?? "string",
            content: inline.content,
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
      const rawPaths = Array.isArray(content.paths) ? content.paths : [];
      const paths: BranchPath[] = rawPaths.map((path) => {
        const summary = path as { id: string; label: string; color: string };
        return { ...summary, conditions: [] };
      });
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

function mergeBranchTargets(
  branch: BranchCell,
  branchNode: FlowNode,
  edges: FlowEdge[],
): BranchCell {
  const targets = new Map<string, string>();
  for (const edge of edges) {
    if (getFlowEdgeKind(edge) !== "branch" || edge.source !== branchNode.id) continue;
    if (!edge.sourceHandle) {
      throw new Error(`Branch edge "${edge.id}" is missing its path handle.`);
    }
    if (targets.has(edge.sourceHandle)) {
      throw new Error(`Branch path "${edge.sourceHandle}" has more than one target.`);
    }
    targets.set(edge.sourceHandle, edge.target);
  }

  return {
    ...branch,
    paths: branch.paths.map((path) => {
      const gotoCellId = targets.get(path.id);
      if (gotoCellId) return { ...path, gotoCellId };
      const { gotoCellId: _removed, ...withoutTarget } = path;
      return withoutTarget;
    }),
  };
}

/**
 * Apply graph structure to the draft while preserving all existing payload by
 * cell id. New nodes are materialised from their graph payload; existing nodes
 * are never reconstructed. Existing outputs keep their array index unless
 * their producer itself moves; outputs of a moved producer travel with it.
 */
export function flowNodesToWorkbookCells(
  nodes: FlowNode[],
  edges: FlowEdge[],
  existingCells: WorkbookCell[] = [],
): WorkbookCell[] {
  const ordered = orderFlowNodes(nodes, edges);
  const existingById = new Map(existingCells.map((cell) => [cell.id, cell]));
  const orderedIds = new Set(ordered.map((node) => node.id));
  const originalExistingOrder = existingCells
    .filter((cell) => cell.type !== "output" && orderedIds.has(cell.id))
    .map((cell) => cell.id);
  const nextExistingOrder = ordered
    .filter((node) => existingById.get(node.id)?.type !== "output" && existingById.has(node.id))
    .map((node) => node.id);
  const originalIndexById = new Map(originalExistingOrder.map((id, index) => [id, index]));
  const movedProducerIds = new Set(
    nextExistingOrder.filter((id, index) => originalIndexById.get(id) !== index),
  );
  const movedOutputsByProducer = new Map<string, WorkbookCell[]>();
  const stationaryOutputs: { cell: WorkbookCell; index: number }[] = [];

  for (const [index, cell] of existingCells.entries()) {
    if (cell.type !== "output") continue;
    // Outputs are owned by their producer: deleting the producer deletes them.
    if (existingById.has(cell.producedBy) && !orderedIds.has(cell.producedBy)) continue;
    if (movedProducerIds.has(cell.producedBy)) {
      const outputs = movedOutputsByProducer.get(cell.producedBy) ?? [];
      outputs.push(cell);
      movedOutputsByProducer.set(cell.producedBy, outputs);
    } else {
      stationaryOutputs.push({ cell, index });
    }
  }

  const cells: WorkbookCell[] = [];
  for (const node of ordered) {
    const existing = existingById.get(node.id);
    let cell: WorkbookCell | null;
    if (existing) {
      cell =
        existing.type === "branch" && node.type === "branch"
          ? mergeBranchTargets(existing, node, edges)
          : existing;
    } else {
      cell = nodeToCell(node);
      if (cell?.type === "branch") {
        cell = mergeBranchTargets(cell, node, edges);
      }
    }

    if (!cell || cell.type === "output") continue;
    cells.push(cell, ...(movedOutputsByProducer.get(cell.id) ?? []));
  }

  // Insert in original order so a no-op projection is byte-identical even
  // when an output was intentionally not adjacent to its producer.
  for (const output of stationaryOutputs) {
    cells.splice(Math.min(output.index, cells.length), 0, output.cell);
  }

  return cells;
}
