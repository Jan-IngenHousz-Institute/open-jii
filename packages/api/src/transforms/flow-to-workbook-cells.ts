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
import { zParallelCell } from "../domains/workbook/workbook-cells.schema";
import { resolveBranchPathById } from "./evaluate-branch";

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

    case "parallel": {
      const parsed = zParallelCell.safeParse({
        id: node.id,
        type: "parallel",
        isCollapsed: false,
        name: typeof content.name === "string" ? content.name : node.name,
        defaultLaneId:
          typeof content.defaultLaneId === "string" ? content.defaultLaneId : undefined,
        lanes: content.lanes,
      });
      if (!parsed.success) {
        throw new Error(
          `Invalid parallel container "${node.id}": ${parsed.error.errors[0].message}`,
        );
      }
      return parsed.data;
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
  const branchEdges = edges.filter(
    (edge) => getFlowEdgeKind(edge) === "branch" && edge.source === branchNode.id,
  );
  const duplicateIds = new Set(
    branch.paths
      .filter((path) => resolveBranchPathById(branch.paths, path.id).status === "ambiguous")
      .map((path) => path.id),
  );

  // Handles cannot identify one member of a duplicate-id group. Preserve such
  // paths byte-for-byte when their target multiset is untouched, so unrelated
  // reorders/additions/deletions remain saveable. Refuse only an operation that
  // actually changes the ambiguous group's targets.
  for (const pathId of duplicateIds) {
    const existingTargets = branch.paths
      .flatMap((path) => (path.id === pathId && path.gotoCellId ? [path.gotoCellId] : []))
      .sort();
    const projectedTargets = branchEdges
      .filter((edge) => edge.sourceHandle === pathId)
      .map((edge) => edge.target)
      .sort();
    if (JSON.stringify(existingTargets) !== JSON.stringify(projectedTargets)) {
      throw new Error(
        `Path id "${pathId}" belongs to multiple branch paths. Open the branch node settings and edit the intended path there.`,
      );
    }
  }

  const targets = new Map<BranchPath, string>();
  for (const edge of branchEdges) {
    if (!edge.sourceHandle) {
      throw new Error(`Branch edge "${edge.id}" is missing its path handle.`);
    }
    if (duplicateIds.has(edge.sourceHandle)) continue;
    const pathResolution = resolveBranchPathById(branch.paths, edge.sourceHandle);
    if (pathResolution.status !== "resolved") {
      throw new Error(
        `Branch path "${edge.sourceHandle}" is ${pathResolution.status}. Repair its path id before saving the canvas.`,
      );
    }
    if (targets.has(pathResolution.path)) {
      throw new Error(`Branch path "${edge.sourceHandle}" has more than one target.`);
    }
    targets.set(pathResolution.path, edge.target);
  }

  return {
    ...branch,
    paths: branch.paths.map((path) => {
      if (duplicateIds.has(path.id)) return path;
      const gotoCellId = targets.get(path);
      if (gotoCellId) return { ...path, gotoCellId };
      const { gotoCellId: _removed, ...withoutTarget } = path;
      return withoutTarget;
    }),
  };
}

/**
 * Apply graph structure to the draft while preserving all existing payload by
 * cell id. New nodes are materialised from their graph payload; existing nodes
 * are never reconstructed. Existing outputs preserve their original offset
 * from a surviving producer as the surrounding sequence changes.
 */
export function flowNodesToWorkbookCells(
  nodes: FlowNode[],
  edges: FlowEdge[],
  existingCells: WorkbookCell[] = [],
): WorkbookCell[] {
  const ordered = orderFlowNodes(nodes, edges);
  const existingById = new Map(existingCells.map((cell) => [cell.id, cell]));
  const orderedIds = new Set(ordered.map((node) => node.id));

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
    cells.push(cell);
  }

  const survivingExistingCells = existingCells.filter((cell) => {
    if (cell.type !== "output") return orderedIds.has(cell.id);
    return !existingById.has(cell.producedBy) || orderedIds.has(cell.producedBy);
  });
  const originalProducerIndex = new Map<string, number>();
  for (const [index, cell] of survivingExistingCells.entries()) {
    if (cell.type !== "output" && !originalProducerIndex.has(cell.id)) {
      originalProducerIndex.set(cell.id, index);
    }
  }

  // Insert outputs in their original order. Recomputing the producer's current
  // index after each insertion keeps multiple producers/outputs composable.
  for (const [outputIndex, output] of survivingExistingCells.entries()) {
    if (output.type !== "output") continue;

    const producerIndex = cells.findIndex((cell) => cell.id === output.producedBy);
    const previousProducerIndex = originalProducerIndex.get(output.producedBy);
    const targetIndex =
      producerIndex >= 0 && previousProducerIndex !== undefined
        ? producerIndex + (outputIndex - previousProducerIndex)
        : outputIndex;
    cells.splice(Math.max(0, Math.min(targetIndex, cells.length)), 0, output);
  }

  return cells;
}
