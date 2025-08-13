/*
  NOTE: This component is currently not used in the application but is kept
  for potential future use as part of the experiment creation wizard.
*/
import type { Node, Edge, Connection, NodeProps } from "@xyflow/react";
import {
  MarkerType,
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  getIncomers,
  getOutgoers,
  getConnectedEdges,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Maximize2, Minimize2 } from "lucide-react";
import { useCallback, useState, useEffect, useRef } from "react";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
} from "@repo/ui/components";

import { LegendFlow } from "../legend-flow";
import { BaseNode } from "../react-flow/base-node";
import { getInitialFlowData } from "../react-flow/flow-utils";
import type { NodeType } from "../react-flow/node-config";
import { ALL_NODE_TYPES, getStyledEdges } from "../react-flow/node-config";
import { createNewNode } from "../react-flow/node-utils";
import { ExperimentSidePanel } from "../side-panel-flow/side-panel-flow";

export function NewExperimentFlow({
  onNodeSelect,
  onFlowStateChange,
  initialNodes: providedInitialNodes,
  initialEdges: providedInitialEdges,
}: {
  onNodeSelect?: (node: Node | null) => void;
  onFlowStateChange?: (nodes: Node[], edges: Edge[]) => void;
  initialNodes?: Node[];
  initialEdges?: Edge[];
}) {
  // State for selected edge and node
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Ref for flow area container used by LegendFlow overlay
  const flowAreaRef = useRef<HTMLDivElement | null>(null);

  // Prevent body scroll when fullscreen is active; restore on exit
  useEffect(() => {
    if (!isFullscreen) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [isFullscreen]);

  // Initialize nodes and edges from provided data or default data
  const { nodes: defaultInitialNodes, edges: defaultInitialEdges } = getInitialFlowData();
  const [nodes, setNodes, onNodesChange] = useNodesState(
    providedInitialNodes ?? defaultInitialNodes,
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    providedInitialEdges ?? defaultInitialEdges,
  );

  // Update nodes and edges when new initial data is provided
  useEffect(() => {
    if (providedInitialNodes) {
      setNodes(providedInitialNodes);
    }
  }, [providedInitialNodes, setNodes]);

  useEffect(() => {
    if (providedInitialEdges) {
      setEdges(providedInitialEdges);
    }
  }, [providedInitialEdges, setEdges]);

  // Notify parent component when flow state changes
  useEffect(() => {
    if (onFlowStateChange) {
      onFlowStateChange(nodes, edges);
    }
  }, [nodes, edges, onFlowStateChange]);

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

  // Handle node title changes
  const handleTitleChange = useCallback(
    (newTitle: string) => {
      if (selectedNode) {
        setNodes((nds) =>
          nds.map((node) =>
            node.id === selectedNode.id
              ? { ...node, data: { ...node.data, title: newTitle } }
              : node,
          ),
        );
        // Update the selected node state to reflect the change
        setSelectedNode((prevNode) =>
          prevNode ? { ...prevNode, data: { ...prevNode.data, title: newTitle } } : null,
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

  // Handle node data changes (including stepSpecification)
  const handleNodeDataChange = useCallback(
    (nodeId: string, newData: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((node) => (node.id === nodeId ? { ...node, data: newData } : node)),
      );
      // Update selected node if it's the one being changed
      if (selectedNode && selectedNode.id === nodeId) {
        setSelectedNode({ ...selectedNode, data: newData });
      }
    },
    [setNodes, selectedNode],
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
      <div
        className={
          isFullscreen
            ? "fixed inset-0 z-50 flex h-screen w-screen flex-col overflow-hidden overscroll-contain bg-white p-0"
            : undefined
        }
      >
        <Card
          className={
            isFullscreen ? "flex h-full flex-col rounded-none border-0 shadow-none" : undefined
          }
        >
          {!isFullscreen && (
            <CardHeader>
              <CardTitle>Experiment Flow</CardTitle>
              <CardDescription>
                Visualize and connect your experiment flow nodes below. Drag from the legend to add
                new nodes.
              </CardDescription>
              {/* Fullscreen button removed from here */}
            </CardHeader>
          )}
          <CardContent className={isFullscreen ? "min-h-0 flex-1 overflow-auto p-6" : undefined}>
            <div
              className={
                isFullscreen
                  ? "flex h-full min-h-0 flex-col gap-4 md:flex-row"
                  : "flex flex-col gap-4 md:flex-row"
              }
            >
              {/* Flow Area */}
              <Card className={isFullscreen ? "flex h-full min-h-0 flex-1 flex-col" : "flex-1"}>
                <CardContent className={isFullscreen ? "min-h-0 flex-1 p-0" : "p-0"}>
                  <div
                    ref={flowAreaRef}
                    className={
                      isFullscreen ? "relative h-full w-full" : "relative h-[700px] w-full"
                    }
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                  >
                    {/* Fullscreen controls overlay */}
                    <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                        onClick={() => setIsFullscreen((v) => !v)}
                      >
                        {isFullscreen ? (
                          <Minimize2 className="h-4 w-4" />
                        ) : (
                          <Maximize2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

                    {/* ReactFlow canvas */}
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
                      fitView
                      deleteKeyCode={[]}
                      defaultEdgeOptions={{
                        markerEnd: { type: MarkerType.ArrowClosed },
                      }}
                    />

                    {/* Legend overlay (inside ReactFlow on md+ for all states) */}
                    <LegendFlow
                      overlay
                      dragHandle
                      containerRef={flowAreaRef}
                      initialCorner="bottom-right"
                      cardClassName="cursor-grab bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50 border border-slate-200"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Legend below on small screens (both fullscreen and normal) */}
              <div className="md:hidden">
                <LegendFlow />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Side panel for nodes and edges */}
      <ExperimentSidePanel
        open={!!selectedNode || !!selectedEdgeId}
        selectedNode={selectedNode}
        nodeType={selectedNode?.type}
        nodeTitle={
          typeof selectedNode?.data.title === "string" ? selectedNode.data.title : undefined
        }
        onClose={() => {
          setSelectedNode(null);
          setSelectedEdgeId(null);
        }}
        onTitleChange={handleTitleChange}
        onNodeDataChange={handleNodeDataChange}
        selectedEdge={edges.find((edge) => edge.id === selectedEdgeId) ?? null}
        onEdgeUpdate={handleEdgeUpdate}
        onEdgeDelete={handleEdgeDelete}
        nodes={nodes}
      />
    </>
  );
}
