import type { Node, Edge } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";

import type { ExperimentUpsertFlowBody } from "@repo/api/domains/experiment/flows/experiment-flows.schema";

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
        animated: incomingSequence[0].animated || outgoingSequence[0].animated,
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
