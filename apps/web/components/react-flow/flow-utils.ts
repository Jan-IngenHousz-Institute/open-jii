import type { Node, Edge } from "@xyflow/react";
import { MarkerType, getIncomers, getOutgoers, getConnectedEdges } from "@xyflow/react";

import type { UpsertFlowBody } from "@repo/api";

import { FlowMapper } from "../flow-editor/flow-mapper";
import { createNewNode, validateFlowNodes } from "./node-utils";

// Start with an empty canvas; real flows are loaded & transformed via FlowMapper
export function getInitialFlowData(): { nodes: Node[]; edges: Edge[] } {
  return { nodes: [], edges: [] };
}

/**
 * Converts nodes and edges to API format if validation passes.
 * Returns null if the flow is not ready for saving.
 */
export function getFlowData(nodes: Node[], edges: Edge[]): UpsertFlowBody | null {
  if (!validateFlowNodes(nodes)) return null;

  try {
    return FlowMapper.toApiGraph(nodes, edges);
  } catch (e) {
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
  allNodes: Node[],
  currentEdges: Edge[],
): Edge[] {
  return deletedNodes.reduce<Edge[]>((acc, node) => {
    const incomers = getIncomers(node, allNodes, acc);
    const outgoers = getOutgoers(node, allNodes, acc);
    const connected = getConnectedEdges([node], acc);

    // Drop edges touching this node
    const filtered = acc.filter((e) => !connected.includes(e));

    // Reconnect incomers to outgoers
    const reconnected = incomers.flatMap(({ id: s }) =>
      outgoers.flatMap(({ id: t }) => {
        const alreadyExists = filtered.some((e) => e.source === s && e.target === t);
        if (alreadyExists) return [];

        const wasAnimated = connected.some((e) =>
          (e.source === s && e.target === node.id) || (e.source === node.id && e.target === t)
            ? e.animated
            : false,
        );
        return [
          {
            id: `${s}->${t}`,
            source: s,
            target: t,
            markerEnd: { type: MarkerType.ArrowClosed },
            animated: wasAnimated,
          },
        ];
      }),
    );

    return [...filtered, ...reconnected];
  }, currentEdges);
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
