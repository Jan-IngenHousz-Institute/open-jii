import type { Connection, Node, Edge } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";

import type { ExperimentUpsertFlowBody } from "@repo/api/domains/experiment/flows/experiment-flows.schema";
import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import { resolveBranchPathById } from "@repo/api/transforms/evaluate-branch";

import { FlowMapper } from "../flow-editor/flow-mapper";
import { createNewNode } from "./node-utils";

export interface FlowRepairIssue {
  kind: "branch-target-deleted" | "invalid-sequence-neighborhood";
  deletedNodeId: string;
  branchNodeId?: string;
  pathId?: string;
}

export interface NodeDeletionResult {
  edges: Edge[];
  issues: FlowRepairIssue[];
}

export function getReactFlowEdgeKind(edge: Edge): "sequence" | "branch" {
  return edge.data?.kind === "branch" || edge.data?.kind === "sequence"
    ? edge.data.kind
    : edge.sourceHandle
      ? "branch"
      : "sequence";
}

export interface ConnectFlowResult {
  nodes: Node[];
  edges: Edge[];
}

function orderReactFlowNodes(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return [];
  const start = nodes.find((node) => node.data.isStartNode === true);
  if (!start) throw new Error("Exactly one start node is required.");

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const nextById = new Map<string, string>();
  for (const edge of edges) {
    if (getReactFlowEdgeKind(edge) !== "sequence") continue;
    if (nextById.has(edge.source)) {
      throw new Error(`Node "${edge.source}" has more than one sequence successor.`);
    }
    nextById.set(edge.source, edge.target);
  }

  const ordered: Node[] = [];
  const visited = new Set<string>();
  let current: Node | undefined = start;
  while (current && !visited.has(current.id)) {
    ordered.push(current);
    visited.add(current.id);
    const nextId = nextById.get(current.id);
    current = nextId ? byId.get(nextId) : undefined;
  }
  if (ordered.length !== nodes.length) {
    throw new Error("Sequence edges must form one chain covering every node exactly once.");
  }
  return ordered;
}

/** Connect a branch reference, or atomically move the target after the source in the sequence. */
export function connectFlowNodes(
  connection: Connection,
  nodes: Node[],
  edges: Edge[],
): ConnectFlowResult {
  if (!connection.source || !connection.target || connection.source === connection.target) {
    return { nodes, edges };
  }

  const sourceNode = nodes.find((node) => node.id === connection.source);
  const isBranchReference =
    sourceNode?.type === "BRANCH" &&
    Boolean(connection.sourceHandle) &&
    connection.sourceHandle !== "out";

  if (isBranchReference) {
    const paths = (
      sourceNode.data.stepSpecification as { paths?: { id: string; label: string }[] } | undefined
    )?.paths;
    const pathResolution = resolveBranchPathById(paths ?? [], connection.sourceHandle ?? undefined);
    if (pathResolution.status !== "resolved") {
      throw new Error(
        `Branch path "${connection.sourceHandle}" is ${pathResolution.status}. Repair its path id before retargeting it.`,
      );
    }
    const path = pathResolution.path;
    const nextEdges = edges.filter(
      (edge) =>
        !(
          getReactFlowEdgeKind(edge) === "branch" &&
          edge.source === connection.source &&
          edge.sourceHandle === connection.sourceHandle
        ),
    );
    return {
      nodes,
      edges: [
        ...nextEdges,
        {
          id: `e-${connection.source}-${connection.sourceHandle}-${connection.target}`,
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle,
          targetHandle: connection.targetHandle,
          markerEnd: { type: MarkerType.ArrowClosed },
          data: { kind: "branch", label: path.label },
        },
      ],
    };
  }

  const ordered = orderReactFlowNodes(nodes, edges);
  const target = ordered.find((node) => node.id === connection.target);
  if (!target) return { nodes, edges };
  const withoutTarget = ordered.filter((node) => node.id !== connection.target);
  const sourceIndex = withoutTarget.findIndex((node) => node.id === connection.source);
  if (sourceIndex === -1) return { nodes, edges };
  withoutTarget.splice(sourceIndex + 1, 0, target);

  const nextNodes = nodes.map((node) => ({
    ...node,
    data: { ...node.data, isStartNode: node.id === withoutTarget[0].id },
  }));
  const branchEdges = edges.filter((edge) => getReactFlowEdgeKind(edge) === "branch");
  const sequenceEdges: Edge[] = withoutTarget.slice(0, -1).map((node, index) => ({
    id: `e-${node.id}-${withoutTarget[index + 1].id}`,
    source: node.id,
    target: withoutTarget[index + 1].id,
    sourceHandle: node.type === "BRANCH" ? "out" : undefined,
    targetHandle: "in",
    markerEnd: { type: MarkerType.ArrowClosed },
    data: { kind: "sequence" },
  }));

  return { nodes: nextNodes, edges: [...sequenceEdges, ...branchEdges] };
}

/** Resolve a spatial drop to a raw cell-array insertion point without ungluing outputs. */
export function getWorkbookCellInsertionIndex(
  cells: WorkbookCell[],
  nodes: Node[],
  dropX: number,
): number {
  const beforeId = [...nodes]
    .sort((left, right) => left.position.x - right.position.x)
    .find((node) => node.position.x > dropX)?.id;
  if (!beforeId) return cells.length;
  const index = cells.findIndex((cell) => cell.id === beforeId);
  return index < 0 ? cells.length : index;
}

// Start with an empty canvas; real flows are loaded & transformed via FlowMapper
export function getInitialFlowData(): { nodes: Node[]; edges: Edge[] } {
  return { nodes: [], edges: [] };
}

/**
 * Converts nodes and edges to API format if validation passes.
 * Throws an error if the flow has validation issues that should be shown to the user.
 */
export function getFlowData(nodes: Node[], edges: Edge[]): ExperimentUpsertFlowBody | null {
  try {
    return FlowMapper.toApiGraph(nodes, edges);
  } catch (e) {
    if (e instanceof Error) {
      throw e;
    }
    console.warn("Flow conversion error: ", e);
    return null;
  }
}

/**
 * Handles node deletion with automatic edge reconnection.
 * When nodes are deleted, their incoming and outgoing edges are reconnected automatically.
 */
export function handleNodesDeleteWithReconnection(
  deletedNodes: Node[],
  _allNodes: Node[],
  currentEdges: Edge[],
): NodeDeletionResult {
  const issues: FlowRepairIssue[] = [];
  const edges = deletedNodes.reduce<Edge[]>((acc, node) => {
    const incomingSequence = acc.filter(
      (edge) => edge.target === node.id && getReactFlowEdgeKind(edge) === "sequence",
    );
    const outgoingSequence = acc.filter(
      (edge) => edge.source === node.id && getReactFlowEdgeKind(edge) === "sequence",
    );
    const incomingBranches = acc.filter(
      (edge) => edge.target === node.id && getReactFlowEdgeKind(edge) === "branch",
    );

    for (const edge of incomingBranches) {
      issues.push({
        kind: "branch-target-deleted",
        deletedNodeId: node.id,
        branchNodeId: edge.source,
        pathId: edge.sourceHandle ?? undefined,
      });
    }

    const filtered = acc.filter((edge) => edge.source !== node.id && edge.target !== node.id);
    if (incomingSequence.length === 0 || outgoingSequence.length === 0) return filtered;

    if (incomingSequence.length !== 1 || outgoingSequence.length !== 1) {
      issues.push({ kind: "invalid-sequence-neighborhood", deletedNodeId: node.id });
      return filtered;
    }

    const source = incomingSequence[0].source;
    const target = outgoingSequence[0].target;
    const alreadyExists = filtered.some(
      (edge) =>
        edge.source === source &&
        edge.target === target &&
        getReactFlowEdgeKind(edge) === "sequence",
    );
    if (alreadyExists) return filtered;

    return [
      ...filtered,
      {
        id: `e-${source}-${target}`,
        source,
        target,
        markerEnd: { type: MarkerType.ArrowClosed },
        animated: [incomingSequence[0].animated, outgoingSequence[0].animated].some(Boolean),
        data: { kind: "sequence" },
      },
    ];
  }, currentEdges);

  return { edges, issues };
}

/**
 * Handles drag and drop for creating new nodes.
 * Returns the new node to add, or null if the drop should be ignored.
 */
export function handleNodeDrop(
  e: React.DragEvent,
  currentNodes: Node[],
  isDisabled: boolean,
): { newNode: Node; position: { x: number; y: number } } | null {
  if (isDisabled) return null; // No drag and drop in disabled mode

  e.preventDefault();
  const type = e.dataTransfer.getData("application/reactflow");
  if (!type) return null;

  const bounds = e.currentTarget.getBoundingClientRect();
  const position = { x: e.clientX - bounds.left, y: e.clientY - bounds.top };

  const newNode = createNewNode(type, position);

  // If this is the very first node, mark it as the start node automatically
  if (currentNodes.length === 0) {
    newNode.data = { ...newNode.data, isStartNode: true };
  }

  return { newNode, position };
}
