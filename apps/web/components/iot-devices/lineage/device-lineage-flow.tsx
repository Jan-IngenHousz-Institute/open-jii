"use client";

import { useLocale } from "@/hooks/useLocale";
import { formatRelativeTime } from "@/util/date";
import type { Edge, Node, NodeTypes } from "@xyflow/react";
import { Background, BackgroundVariant, Controls, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo } from "react";

import type { DeviceLineageModel, LineageEdgeModel } from "./build-device-lineage";
import { layoutLineage } from "./layout-lineage";
import { LineageNode } from "./lineage-node";

const NODE_TYPES: NodeTypes = { lineage: LineageNode };

/** Edge states whose count is a measurement volume worth labelling. */
const COUNTED_STATES: readonly LineageEdgeModel["state"][] = [
  "input",
  "processing",
  "unattributed",
];

const EDGE_STYLE: Record<LineageEdgeModel["state"], React.CSSProperties> = {
  identity: { stroke: "#CDD5DB", strokeWidth: 1.5 },
  input: { stroke: "#CDD5DB", strokeWidth: 1.5 },
  processing: { stroke: "#6F8596", strokeWidth: 1.5, strokeDasharray: "2 4" },
  active: { stroke: "#005e5e", strokeWidth: 2 },
  silent: { stroke: "#CDD5DB", strokeWidth: 1.5, strokeDasharray: "6 4" },
  unbound: { stroke: "#D97706", strokeWidth: 1.5, strokeDasharray: "6 4" },
  unattributed: { stroke: "#94A3B8", strokeWidth: 1.5, strokeDasharray: "6 4" },
};

interface DeviceLineageFlowProps {
  model: DeviceLineageModel;
  selectedNodeId: string | null;
  /** Ids, not node models: the caller re-reads the current model, so a
   * background refetch cannot leave the inspect panel on a stale snapshot. */
  onSelect: (nodeId: string | null) => void;
}

/** Read-only lineage canvas: layout and selection only, no editing surface. */
export function DeviceLineageFlow({ model, selectedNodeId, onSelect }: DeviceLineageFlowProps) {
  const locale = useLocale();

  // Layout is selection-independent, so clicking a node never re-lays out.
  const { layoutNodes, edges } = useMemo(() => {
    const flowNodes: Node[] = model.nodes.map((node) => ({
      id: node.id,
      type: "lineage",
      position: { x: 0, y: 0 },
      data: { model: node },
    }));

    const flowEdges: Edge[] = model.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      style: EDGE_STYLE[edge.state],
      animated: edge.state === "active",
      label: edgeLabel(edge, locale),
      labelStyle: { fontSize: 11, fill: "#68737B" },
      labelBgStyle: { fill: "#FFFFFF", fillOpacity: 0.85 },
    }));

    return { layoutNodes: layoutLineage(flowNodes), edges: flowEdges };
  }, [model, locale]);

  const nodes = useMemo(
    () => layoutNodes.map((node) => ({ ...node, selected: node.id === selectedNodeId })),
    [layoutNodes, selectedNodeId],
  );

  const handleNodeClick = (_event: React.MouseEvent, node: Node) => {
    onSelect(node.id);
  };

  const handlePaneClick = () => {
    onSelect(null);
  };

  return (
    <div className="h-135 w-full rounded-lg border" data-testid="lineage-flow">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        fitView
        fitViewOptions={{ padding: 0.2, minZoom: 0.4, maxZoom: 1.1 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#E2E8F0" />
        <Controls position="bottom-right" showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

/** Counts (and recency for live edges) ride the data-bearing edges. */
function edgeLabel(edge: LineageEdgeModel, locale: string): string | undefined {
  if (edge.state === "active" && edge.count !== null) {
    return edge.lastBucketAt === null
      ? String(edge.count)
      : `${String(edge.count)} · ${formatRelativeTime(edge.lastBucketAt, locale)}`;
  }
  if (edge.count !== null && COUNTED_STATES.includes(edge.state)) {
    return String(edge.count);
  }
  return undefined;
}
