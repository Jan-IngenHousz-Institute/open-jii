"use client";

import type { Node, Edge } from "@xyflow/react";
import { ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { Card, CardHeader, CardTitle, CardContent } from "@repo/ui/components";

import { BaseNode } from "../react-flow/base-node";
import type { NodeType } from "../react-flow/node-config";
import { ALL_NODE_TYPES, getStyledEdges } from "../react-flow/node-config";

interface StaticFlowViewerProps {
  nodes: Node[];
  edges: Edge[];
  title?: string;
  description?: string;
  className?: string;
}

export function StaticFlowViewer({
  nodes,
  edges,
  title = "Experiment Flow",
  description = "Visual representation of your experiment flow",
  className = "",
}: StaticFlowViewerProps) {
  // Create static node wrapper component (no editing capabilities)
  const StaticNodeWrapper = (props: any) => (
    <BaseNode
      {...props}
      nodes={nodes}
      onNodeSelect={() => {}} // No-op for static view
      onNodeDelete={() => {}} // No-op for static view
      isStatic={true} // Pass static flag to BaseNode if it supports it
    />
  );

  // Node types configuration for static view
  const nodeTypes = ALL_NODE_TYPES.reduce(
    (map, type) => {
      map[type] = StaticNodeWrapper;
      return map;
    },
    {} as Record<NodeType, React.ComponentType<any>>,
  );

  // Apply edge styles
  const styledEdges = getStyledEdges(edges, null);

  if (nodes.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-center py-8">
          No flow configured for this experiment yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && (
          <p className="text-muted-foreground text-sm">{description}</p>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[400px]">
          <ReactFlow
            nodes={nodes}
            edges={styledEdges}
            nodeTypes={nodeTypes}
            defaultViewport={{ x: 50, y: 50, zoom: 1 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag={true}
            zoomOnScroll={true}
            zoomOnPinch={true}
            zoomOnDoubleClick={false}
            deleteKeyCode={null}
            fitView
            fitViewOptions={{ padding: 0.1 }}
          />
        </div>
      </CardContent>
    </Card>
  );
}