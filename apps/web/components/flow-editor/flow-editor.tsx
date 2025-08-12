"use client";

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
import { Maximize2, Minimize2 } from "lucide-react";
import {
  useCallback,
  useState,
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  createContext,
  useContext,
} from "react";

import type { Flow } from "@repo/api";
import type { UpsertFlowBody } from "@repo/api";
import { Card, CardContent, Button } from "@repo/ui/components";

import { LegendFlow } from "../legend-flow";
import { BaseNode } from "../react-flow/base-node";
import { createNewNode } from "../react-flow/flow-utils";
import type { NodeType } from "../react-flow/node-config";
import { ALL_NODE_TYPES, getStyledEdges } from "../react-flow/node-config";
import { ExperimentSidePanel } from "../side-panel-flow/side-panel-flow";
import { FlowMapper } from "./flow-mapper";

// Context for sharing node management functions
interface FlowContextType {
  nodes: Node[];
  onNodeSelect: (node: Node | null) => void;
  onNodeDelete: (nodeId: string) => void;
  onNodeDataChange: (nodeId: string, newData: Record<string, unknown>) => void;
}

const FlowContext = createContext<FlowContextType | null>(null);

// BaseNode wrapper that uses context
const BaseNodeWrapper = (props: NodeProps) => {
  const context = useContext(FlowContext);
  if (!context) {
    throw new Error("BaseNodeWrapper must be used within FlowContext.Provider");
  }
  return (
    <BaseNode
      {...props}
      nodes={context.nodes}
      onNodeSelect={context.onNodeSelect}
      onNodeDelete={context.onNodeDelete}
    />
  );
};

// FlowContextProvider component
const FlowContextProvider: React.FC<{
  children: React.ReactNode;
  nodes: Node[];
  onNodeSelect: (node: Node | null) => void;
  onNodeDelete: (nodeId: string) => void;
  onNodeDataChange: (nodeId: string, newData: Record<string, unknown>) => void;
}> = ({ children, nodes, onNodeSelect, onNodeDelete, onNodeDataChange }) => {
  const value = { nodes, onNodeSelect, onNodeDelete, onNodeDataChange };
  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
};

// Define nodeTypes outside the component to avoid re-creation
const nodeTypes = ALL_NODE_TYPES.reduce(
  (map, type) => {
    map[type] = BaseNodeWrapper;
    return map;
  },
  {} as Record<NodeType, React.ComponentType<NodeProps>>,
);

export interface FlowEditorHandle {
  getFlowData: () => UpsertFlowBody | null; // null when not ready
}

interface FlowEditorProps {
  initialFlow?: Flow;
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

    // Initialize nodes and edges from API flow or empty arrays
    const initialData = initialFlow
      ? FlowMapper.toReactFlow(initialFlow)
      : { nodes: [], edges: [] };

    const [nodes, setNodes, onNodesChange] = useNodesState(initialData.nodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialData.edges);

    // Ref for flow area container used by LegendFlow overlay
    const flowAreaRef = useRef<HTMLDivElement | null>(null);

    // Update when initialFlow changes
    useEffect(() => {
      if (initialFlow) {
        const converted = FlowMapper.toReactFlow(initialFlow);
        setNodes(converted.nodes);
        setEdges(converted.edges);
      }
    }, [initialFlow, setNodes, setEdges]);

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
        getFlowData: () => {
          if (nodes.length === 0) return null;
          const isObject = (v: unknown): v is Record<string, unknown> =>
            typeof v === "object" && v !== null;
          const allReady = nodes.every((n) => {
            const data = n.data;
            if (n.type === "MEASUREMENT") {
              const spec = data.stepSpecification as { protocolId?: unknown } | undefined;
              const proto =
                (data.protocolId as string | undefined) ??
                (isObject(spec) ? (spec.protocolId as string | undefined) : undefined);
              return typeof proto === "string" && proto.length > 0;
            }
            if (n.type === "QUESTION") {
              const spec = data.stepSpecification as { kind?: unknown; text?: unknown } | undefined;
              if (
                isObject(spec) &&
                typeof spec.kind === "string" &&
                typeof spec.text === "string" &&
                spec.text.length > 0
              ) {
                return true;
              }
              const title = data.title as string | undefined;
              return typeof title === "string" && title.length > 0;
            }
            if (n.type === "INSTRUCTION") {
              const spec = data.stepSpecification as { text?: unknown } | undefined;
              if (isObject(spec) && typeof spec.text === "string" && spec.text.length > 0) {
                return true;
              }
              const title = data.title as string | undefined;
              return typeof title === "string" && title.length > 0;
            }
            return true;
          });
          if (!allReady) return null;
          try {
            return FlowMapper.toApiGraph(nodes, edges);
          } catch (e) {
            console.warn("Flow conversion error: ", e);
            return null;
          }
        },
      }),
      [nodes, edges],
    );

    // Removed: localStorage persistence (positions saved only when flow saved)

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

            // Reconnect incomers to outgoers
            const reconnected = incomers.flatMap(({ id: s }) =>
              outgoers.flatMap(({ id: t }) => {
                const alreadyExists = filtered.some((e) => e.source === s && e.target === t);
                if (alreadyExists) return [];

                const wasAnimated = connected.some((e) =>
                  (e.source === s && e.target === node.id) ||
                  (e.source === node.id && e.target === t)
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
          prevSelected && prevSelected.id === nodeId
            ? { ...prevSelected, data: newData }
            : prevSelected,
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
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed },
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
        if (isDisabled) return; // No drag and drop in disabled mode
        e.preventDefault();
        const type = e.dataTransfer.getData("application/reactflow");
        if (!type) return;

        const bounds = e.currentTarget.getBoundingClientRect();
        const position = { x: e.clientX - bounds.left, y: e.clientY - bounds.top };

        const newNode = createNewNode(type, position);
        setNodes((nds) => {
          // If this is the very first node, mark it as the start node automatically
          if (nds.length === 0) {
            newNode.data = { ...newNode.data, isStartNode: true };
          }
          return [...nds, newNode];
        });
      },
      [setNodes, isDisabled],
    );

    // Apply edge styles based on selection
    // Ensure label is set for display from edge.data.label
    const styledEdges = getStyledEdges(
      edges.map((edge) => {
        const label = edge.data?.label;
        return typeof label === "string" || typeof label === "number"
          ? { ...edge, label: String(label) }
          : { ...edge, label: undefined };
      }),
      selectedEdgeId,
    );

    // Ensure exactly one start node (auto-heal) so validation passes and save button can appear
    useEffect(() => {
      if (nodes.length === 0) return;
      const startNodes = nodes.filter((n) => n.data.isStartNode === true);
      if (startNodes.length === 1) return; // already valid
      setNodes((nds) => {
        if (nds.length === 0) return nds;
        // Pick the first node in list to be start
        const firstId = nds[0].id;
        return nds.map((n) => ({
          ...n,
          data: {
            ...n.data,
            isStartNode: n.id === firstId,
          },
        }));
      });
    }, [nodes, setNodes]);

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
          isDisabled={isDisabled}
        />

        {/* Fullscreen wrapper */}
        <div
          className={
            isFullscreen
              ? "fixed inset-0 z-50 flex h-screen w-screen flex-col overflow-hidden overscroll-contain bg-white p-0"
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
              {/* Flow Area */}
              <Card className={isFullscreen ? "flex h-full min-h-0 flex-1 flex-col" : "flex-1"}>
                <CardContent className={isFullscreen ? "min-h-0 flex-1 p-0" : "p-0"}>
                  <div
                    ref={flowAreaRef}
                    className={
                      isFullscreen ? "relative h-full w-full" : "relative h-[700px] w-full"
                    }
                    onDragOver={isDisabled ? undefined : (e) => e.preventDefault()}
                    onDrop={isDisabled ? undefined : handleDrop}
                  >
                    {/* Fullscreen controls overlay - hide in disabled mode */}
                    {!isDisabled && (
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
                    )}

                    {/* ReactFlow canvas */}
                    <FlowContextProvider
                      nodes={nodes}
                      onNodeSelect={handleNodeSelect}
                      onNodeDelete={handleNodeDelete}
                      onNodeDataChange={handleNodeDataChange}
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
                        deleteKeyCode={[]}
                        nodesDraggable={!isDisabled}
                        nodesConnectable={!isDisabled}
                        elementsSelectable={true}
                        fitView={isFullscreen}
                        defaultViewport={{ x: 50, y: 150, zoom: 1 }}
                        defaultEdgeOptions={{
                          markerEnd: { type: MarkerType.ArrowClosed },
                        }}
                      />
                    </FlowContextProvider>

                    {/* Overlay legend always, except on small screens and when disabled */}
                    {!isDisabled && (
                      <div className="hidden md:block">
                        <LegendFlow
                          overlay
                          containerRef={flowAreaRef}
                          initialCorner="bottom-right"
                          cardClassName="bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50 border border-slate-200"
                        />
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
