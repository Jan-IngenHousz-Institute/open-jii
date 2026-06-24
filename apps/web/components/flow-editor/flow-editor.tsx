"use client";

import type { Node, Edge, Connection } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Maximize2, Minimize2 } from "lucide-react";
import { useCallback, useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";

import type {
  ExperimentFlow,
  ExperimentUpsertFlowBody,
} from "@repo/api/domains/experiment/experiment.schema";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { cn } from "@repo/ui/lib/utils";

import { LegendFlow } from "../legend-flow";
import {
  getFlowData,
  handleNodesDeleteWithReconnection,
  handleNodeDrop,
} from "../react-flow/flow-utils";
import type { NodeType } from "../react-flow/node-config";
import { ALL_NODE_TYPES, getStyledEdges, nodeTypeColorMap } from "../react-flow/node-config";
import { FlowContextProvider, BaseNodeWrapper, ensureOneStartNode } from "../react-flow/node-utils";
import { ExperimentSidePanel } from "../side-panel-flow/side-panel-flow";
import { autoLayout } from "./auto-layout";
import { BackEdge } from "./back-edge";
import { FlowMapper } from "./flow-mapper";

// Define nodeTypes outside the component to avoid re-creation
const nodeTypes = ALL_NODE_TYPES.reduce(
  (map, type) => {
    map[type] = BaseNodeWrapper;
    return map;
  },
  {} as Record<NodeType, React.ComponentType<NodeProps>>,
);

const edgeTypes = { back: BackEdge };

function lookupAccent(type: string | undefined): string {
  if (!type || !(type in nodeTypeColorMap)) return "#94A3B8";
  return nodeTypeColorMap[type as keyof typeof nodeTypeColorMap].accent;
}

export interface FlowEditorHandle {
  getFlowData: () => ExperimentUpsertFlowBody | null; // null when not ready
}

interface FlowEditorProps {
  initialFlow?: ExperimentFlow;
  onNodeSelect?: (node: Node | null) => void;
  onDirtyChange?: (dirty: boolean) => void; // notify parent that there are unsaved changes
  isDisabled?: boolean; // whether the flow is read-only
}

export const FlowEditor = forwardRef<FlowEditorHandle, FlowEditorProps>(
  ({ initialFlow, onNodeSelect, onDirtyChange, isDisabled = false }, ref) => {
    // State for selected edge and node
    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const initialData = initialFlow
      ? FlowMapper.toReactFlow(initialFlow)
      : { nodes: [], edges: [] };
    if (isDisabled && initialData.nodes.length > 0) {
      initialData.nodes = autoLayout(initialData.nodes, initialData.edges);
    }

    const [nodes, setNodes, onNodesChange] = useNodesState(initialData.nodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialData.edges);

    // Ref for flow area container used by LegendFlow overlay
    const flowAreaRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      if (initialFlow) {
        const converted = FlowMapper.toReactFlow(initialFlow);
        const laidOut =
          isDisabled && converted.nodes.length > 0
            ? autoLayout(converted.nodes, converted.edges)
            : converted.nodes;
        setNodes(laidOut);
        setEdges(converted.edges);
      }
    }, [initialFlow, isDisabled, setNodes, setEdges]);

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

    // Track dirty state (skip first render)
    const firstRenderRef = useRef(true);
    useEffect(() => {
      if (firstRenderRef.current) {
        firstRenderRef.current = false;
        return;
      }
      if (onDirtyChange) onDirtyChange(true);
    }, [nodes, edges, onDirtyChange]);

    // Expose getFlowData via ref (constructs API payload only when asked)
    useImperativeHandle(
      ref,
      () => ({
        getFlowData: () => getFlowData(nodes, edges),
      }),
      [nodes, edges],
    );

    // Removed: localStorage persistence (positions saved only when flow saved)

    // Delete logic and reconnection
    const onNodesDelete = useCallback(
      (deleted: Node[]) => {
        setEdges((eds) => handleNodesDeleteWithReconnection(deleted, nodes, eds));
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
        setSelectedEdgeId(null);
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

    // Handle node data changes
    const handleNodeDataChange = useCallback(
      (nodeId: string, newData: Record<string, unknown>) => {
        setNodes((nds) =>
          nds.map((node) => (node.id === nodeId ? { ...node, data: newData } : node)),
        );
        // Update selected node if it's the same node being changed
        setSelectedNode((prevSelected) =>
          prevSelected?.id === nodeId ? { ...prevSelected, data: newData } : prevSelected,
        );
      },
      [setNodes],
    );

    // Edge creation
    const onConnect = useCallback(
      (params: Connection) => {
        if (isDisabled) return; // No connections in disabled mode
        if (params.source === params.target) return;

        const id = `e-${params.source}-${params.target}-${Date.now()}`;
        const newEdge: Edge = {
          id,
          source: params.source,
          target: params.target,
          sourceHandle: params.sourceHandle ?? null,
          targetHandle: params.targetHandle ?? null,
          animated: false,
          markerEnd: { type: MarkerType.ArrowClosed, color: "#CDD5DB" },
        };
        setEdges((eds) => addEdge(newEdge, eds));
      },
      [setEdges, isDisabled],
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
        const result = handleNodeDrop(e, nodes, isDisabled);
        if (result) {
          setNodes((nds) => [...nds, result.newNode]);
        }
      },
      [nodes, isDisabled, setNodes],
    );

    const branchPathColors = new Map<string, string>();
    const nodeXById = new Map<string, number>();
    for (const node of nodes) {
      nodeXById.set(node.id, node.position.x);
      if (node.type !== "BRANCH") continue;
      const paths =
        (node.data as { stepSpecification?: { paths?: { id: string; color: string }[] } })
          .stepSpecification?.paths ?? [];
      for (const path of paths) {
        branchPathColors.set(`${node.id}:${path.id}`, path.color);
      }
    }

    const styledEdges = getStyledEdges(
      edges.map((edge) => {
        const label = edge.data?.label;
        const displayLabel =
          typeof label === "string" || typeof label === "number"
            ? String(label).length > 64
              ? String(label).slice(0, 64) + "..."
              : String(label)
            : undefined;
        const pathColor = edge.sourceHandle
          ? branchPathColors.get(`${edge.source}:${edge.sourceHandle}`)
          : undefined;
        const sourceX = nodeXById.get(edge.source);
        const targetX = nodeXById.get(edge.target);
        const isBackEdge = sourceX !== undefined && targetX !== undefined && targetX < sourceX;
        const edgeType = isBackEdge ? "back" : pathColor ? "default" : "smoothstep";
        return {
          ...edge,
          label: displayLabel,
          type: edgeType,
          pathOptions: edgeType === "smoothstep" ? { borderRadius: 16 } : undefined,
          animated: false,
          markerEnd: { type: MarkerType.ArrowClosed, color: pathColor ?? "#94A3B8" },
          style: { stroke: pathColor ?? "#94A3B8", strokeWidth: pathColor ? 2 : 1.75 },
          labelStyle: { fill: "#475569", fontSize: 11, fontWeight: 500 },
          labelBgStyle: { fill: "#FFFFFF", stroke: "#E2E8F0", strokeWidth: 1 },
          labelBgPadding: [8, 4] as [number, number],
          labelBgBorderRadius: 6,
        };
      }),
      selectedEdgeId,
    );

    // Ensure exactly one start node (auto-heal) so validation passes and save button can appear
    useEffect(() => {
      setNodes((nds) => ensureOneStartNode(nds));
    }, [nodes.length, setNodes]);

    return (
      <div>
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
          onTitleChange={isDisabled ? undefined : handleTitleChange}
          onNodeDataChange={isDisabled ? undefined : handleNodeDataChange}
          selectedEdge={edges.find((edge) => edge.id === selectedEdgeId) ?? null}
          onEdgeUpdate={isDisabled ? undefined : handleEdgeUpdate}
          onEdgeDelete={isDisabled ? undefined : handleEdgeDelete}
          nodes={nodes}
          edges={edges}
          isDisabled={isDisabled}
        />

        {/* Fullscreen wrapper */}
        <div
          className={
            isFullscreen
              ? "fixed inset-0 z-40 flex h-screen w-screen flex-col overflow-hidden overscroll-contain bg-white p-6"
              : undefined
          }
        >
          <Card
            className={isFullscreen ? "flex h-full flex-col rounded-none border-0" : "shadow-none"}
          >
            <div
              className={
                isFullscreen
                  ? "flex h-full min-h-0 flex-col gap-4 md:flex-row"
                  : "flex flex-col gap-4 md:flex-row"
              }
            >
              {/* ExperimentFlow Area */}
              <Card className={isFullscreen ? "flex h-full min-h-0 flex-1 flex-col" : "flex-1"}>
                <CardContent className={isFullscreen ? "min-h-0 flex-1 p-0" : "p-0"}>
                  <div
                    ref={flowAreaRef}
                    className={cn(
                      isFullscreen ? "relative h-full w-full" : "relative h-[700px] w-full",
                      "bg-slate-50/60",
                    )}
                    onDragOver={isDisabled ? undefined : (e) => e.preventDefault()}
                    onDrop={isDisabled ? undefined : handleDrop}
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
                    <FlowContextProvider
                      nodes={nodes}
                      onNodeSelect={handleNodeSelect}
                      onNodeDelete={handleNodeDelete}
                      onNodeDataChange={handleNodeDataChange}
                      isDisabled={isDisabled}
                    >
                      <ReactFlow
                        attributionPosition="bottom-left"
                        nodes={nodes}
                        edges={styledEdges}
                        onNodesChange={isDisabled ? undefined : onNodesChange}
                        onNodesDelete={isDisabled ? undefined : onNodesDelete}
                        onEdgesChange={isDisabled ? undefined : onEdgesChange}
                        onConnect={isDisabled ? undefined : onConnect}
                        onEdgeClick={onEdgeClick}
                        onPaneClick={onPaneClick}
                        nodeTypes={nodeTypes}
                        edgeTypes={edgeTypes}
                        deleteKeyCode={[]}
                        nodesDraggable={!isDisabled}
                        nodesConnectable={!isDisabled}
                        elementsSelectable={true}
                        fitView={isDisabled}
                        fitViewOptions={{ padding: 0.2, minZoom: 0.4, maxZoom: 1.2 }}
                        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                        proOptions={{ hideAttribution: true }}
                        defaultEdgeOptions={{
                          type: "smoothstep",
                          markerEnd: { type: MarkerType.ArrowClosed, color: "#CDD5DB" },
                        }}
                      >
                        <Background
                          variant={BackgroundVariant.Dots}
                          gap={18}
                          size={1.4}
                          color="#CBD5E1"
                        />
                        <Controls position="bottom-right" showInteractive={false} />
                        <MiniMap
                          position="bottom-left"
                          pannable
                          zoomable
                          ariaLabel="ExperimentFlow minimap"
                          maskColor="rgba(241, 245, 249, 0.7)"
                          nodeStrokeWidth={3}
                          nodeBorderRadius={4}
                          nodeColor={(n) => {
                            const accent = lookupAccent(n.type);
                            return `color-mix(in srgb, ${accent} 25%, white)`;
                          }}
                          nodeStrokeColor={(n) => lookupAccent(n.type)}
                          style={{
                            backgroundColor: "#FFFFFF",
                            border: "1px solid #E2E8F0",
                            borderRadius: 8,
                            width: 200,
                            height: 130,
                          }}
                        />
                      </ReactFlow>
                    </FlowContextProvider>

                    {/* Overlay legend always, except on small screens and when disabled */}
                    {!isDisabled && (
                      <div className="hidden md:block">
                        <LegendFlow overlay />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Legend below on small screens - hide in disabled mode */}
              {!isDisabled && (
                <div className="md:hidden">
                  <LegendFlow />
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    );
  },
);

FlowEditor.displayName = "FlowEditor";
