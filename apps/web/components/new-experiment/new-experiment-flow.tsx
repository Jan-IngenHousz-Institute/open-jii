import type { Node, Edge, Connection } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";
import {
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  getIncomers,
  getOutgoers,
  getConnectedEdges,
} from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useState } from "react";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@repo/ui/components";

import { LegendFlow } from "../legend-flow";
import { BaseNode } from "../react-flow/base-node";
import { getInitialFlowData, createNewNode } from "../react-flow/initial-data";
import type { NodeType } from "../react-flow/node-config";
import { ALL_NODE_TYPES, getStyledEdges } from "../react-flow/node-config";
import { ExperimentSidePanel } from "../side-panel-flow/side-panel-flow";

export function NewExperimentFlow({
  onNodeSelect,
}: {
  onNodeSelect?: (node: Node | null) => void;
}) {
  // State for selected edge and node
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Initialize nodes and edges from extracted data
  const { nodes: initialNodes, edges: initialEdges } = getInitialFlowData();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Delete logic and reconnection
  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      setEdges((eds) => {
        const updatedEdges = deleted.reduce<Edge[]>((acc, node) => {
          const incomers = getIncomers(node, nodes, acc);
          const outgoers = getOutgoers(node, nodes, acc);
          const connected = getConnectedEdges([node], acc);

          // Drop edges touching this node
          const filtered = acc.filter((e) => !connected.includes(e));

          // Reconnect incomers to outgoers, but only if no edge already exists between them
          const reconnected = incomers.flatMap(({ id: s }) =>
            outgoers.flatMap(({ id: t }) => {
              // Check if edge already exists between s and t
              const alreadyExists = filtered.some((e) => e.source === s && e.target === t);
              if (alreadyExists) return []; // Do not reconnect if edge exists

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
                  type: "smoothstep" as const,
                  markerEnd: { type: MarkerType.ArrowClosed },
                  animated: wasAnimated,
                },
              ];
            }),
          );

          return [...filtered, ...reconnected];
        }, eds);
        return updatedEdges;
      });
    },
    [nodes, setEdges],
  );

  // Handle node deletion
  const handleNodeDelete = useCallback(
    (nodeId: string) => {
      setNodes((nds) => {
        const toDel = nds.find((n) => n.id === nodeId);
        if (toDel) onNodesDelete([toDel]);
        return nds.filter((n) => n.id !== nodeId);
      });
    },
    [setNodes, onNodesDelete],
  );

  // Handle node selection
  const handleNodeSelect = useCallback(
    (node: Node | null) => {
      setSelectedNode(node);
      setSelectedEdgeId(null); // Clear edge selection when node is selected
      if (onNodeSelect) onNodeSelect(node);
    },
    [onNodeSelect],
  );

  // Handle node label changes
  const handleLabelChange = useCallback(
    (newLabel: string) => {
      if (selectedNode) {
        setNodes((nds) =>
          nds.map((node) =>
            node.id === selectedNode.id
              ? { ...node, data: { ...node.data, label: newLabel } }
              : node,
          ),
        );
        // Update the selected node state to reflect the change
        setSelectedNode((prevNode) =>
          prevNode ? { ...prevNode, data: { ...prevNode.data, label: newLabel } } : null,
        );
      }
    },
    [selectedNode, setNodes],
  );

  // Handle edge updates
  const handleEdgeUpdate = useCallback(
    (edgeId: string, updates: Partial<Edge>) => {
      setEdges((eds) => eds.map((edge) => (edge.id === edgeId ? { ...edge, ...updates } : edge)));
    },
    [setEdges],
  );

  // Handle edge deletion
  const handleEdgeDelete = useCallback(
    (edgeId: string) => {
      setEdges((eds) => eds.filter((edge) => edge.id !== edgeId));
      setSelectedEdgeId(null);
    },
    [setEdges],
  );

  // Create node wrapper component
  const NodeWrapper = (props: NodeProps) => (
    <BaseNode
      {...props}
      nodes={nodes}
      onNodeSelect={handleNodeSelect}
      onNodeDelete={handleNodeDelete}
    />
  );

  // Node types configuration
  const nodeTypes = ALL_NODE_TYPES.reduce(
    (map, type) => {
      map[type] = NodeWrapper;
      return map;
    },
    {} as Record<NodeType, React.ComponentType<NodeProps>>,
  );

  // Edge creation
  const onConnect = useCallback(
    (params: Connection) => {
      if (params.source === params.target) return;

      const id = `e-${params.source}-${params.target}-${Date.now()}`;
      const newEdge: Edge = {
        id,
        source: params.source,
        target: params.target,
        sourceHandle: params.sourceHandle ?? null,
        targetHandle: params.targetHandle ?? null,
        type: "smoothstep",
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges],
  );

  // Edge selection
  const onEdgeClick = useCallback((e: React.MouseEvent, edge: Edge) => {
    e.stopPropagation();
    setSelectedEdgeId(edge.id);
    setSelectedNode(null);
  }, []);

  // Pane click (deselect)
  const onPaneClick = useCallback(() => {
    setSelectedEdgeId(null);
    setSelectedNode(null);
  }, []);

  // Handle drag and drop for new nodes
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/reactflow");
      if (!type) return;

      const bounds = e.currentTarget.getBoundingClientRect();
      const position = { x: e.clientX - bounds.left, y: e.clientY - bounds.top };

      const newNode = createNewNode(type, position);
      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes],
  );

  // Apply edge styles based on selection
  const styledEdges = getStyledEdges(edges, selectedEdgeId);

  return (
    <>
      {/* Side panel for nodes and edges */}
      <ExperimentSidePanel
        open={!!selectedNode || !!selectedEdgeId}
        nodeType={selectedNode?.type}
        nodeLabel={
          typeof selectedNode?.data.label === "string" ? selectedNode.data.label : undefined
        }
        onClose={() => {
          setSelectedNode(null);
          setSelectedEdgeId(null);
        }}
        onLabelChange={handleLabelChange}
        selectedEdge={edges.find((edge) => edge.id === selectedEdgeId) ?? null}
        onEdgeUpdate={handleEdgeUpdate}
        onEdgeDelete={handleEdgeDelete}
      />

      <Card>
        <CardHeader>
          <CardTitle>Experiment Flow</CardTitle>
          <CardDescription>
            Visualize and connect your experiment flow nodes below. Drag from the legend to add new
            nodes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row">
            {/* Flow Area */}
            <Card className="flex-1">
              <CardContent className="p-0">
                <div
                  className="h-[700px]"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                >
                  <ReactFlow
                    nodes={nodes}
                    edges={styledEdges}
                    onNodesChange={onNodesChange}
                    onNodesDelete={onNodesDelete}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onEdgeClick={onEdgeClick}
                    onPaneClick={onPaneClick}
                    nodeTypes={nodeTypes}
                    deleteKeyCode={[]}
                    fitView
                    defaultEdgeOptions={{
                      type: "smoothstep",
                      markerEnd: { type: MarkerType.ArrowClosed },
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Legend */}
            <LegendFlow />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
