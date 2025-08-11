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
import { useCallback, useState, useEffect, useMemo } from "react";

import type { Flow } from "@repo/api";
import type { UpsertFlowBody } from "@repo/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@repo/ui/components";

import { LegendFlow } from "../legend-flow";
import { BaseNode } from "../react-flow/base-node";
import { createNewNode } from "../react-flow/flow-utils";
import type { NodeType } from "../react-flow/node-config";
import { ALL_NODE_TYPES, getStyledEdges } from "../react-flow/node-config";
import { ExperimentSidePanel } from "../side-panel-flow/side-panel-flow";
import { FlowMapper } from "./flow-mapper";

interface FlowEditorProps {
  initialFlow?: Flow;
  onFlowChange?: (flowData: UpsertFlowBody) => void;
  onNodeSelect?: (node: Node | null) => void;
}

export function FlowEditor({ initialFlow, onFlowChange, onNodeSelect }: FlowEditorProps) {
  // State for selected edge and node
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Layout persistence key (frontend only for now)
  const layoutKey = initialFlow ? `flowLayout:${initialFlow.id}` : undefined;

  // Initialize nodes and edges from API flow or default data
  const initialDataRaw = initialFlow
    ? FlowMapper.toReactFlow(initialFlow)
    : { nodes: [], edges: [] };

  // Load persisted positions if available
  let initialData = initialDataRaw;
  if (typeof window !== "undefined" && layoutKey) {
    try {
      const stored = window.localStorage.getItem(layoutKey);
      if (stored) {
        const posMap = JSON.parse(stored) as Record<string, { x: number; y: number }>;
        initialData = {
          ...initialDataRaw,
          nodes: initialDataRaw.nodes.map((n) => {
            const storedPos = posMap[n.id];
            if (storedPos !== undefined) {
              return { ...n, position: storedPos };
            }
            return n;
          }),
        };
      }
    } catch {
      // ignore parse errors
    }
  }

  const [nodes, setNodes, onNodesChange] = useNodesState(initialData.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialData.edges);

  // Update when initialFlow changes
  useEffect(() => {
    if (initialFlow) {
      const converted = FlowMapper.toReactFlow(initialFlow);
      // Apply stored positions if available
      if (typeof window !== "undefined" && layoutKey) {
        try {
          const stored = window.localStorage.getItem(layoutKey);
          if (stored) {
            const posMap = JSON.parse(stored) as Record<string, { x: number; y: number }>;
            converted.nodes = converted.nodes.map((n) => {
              const storedPos = posMap[n.id];
              if (storedPos !== undefined) {
                return { ...n, position: storedPos };
              }
              return n;
            });
          }
        } catch {
          // ignore
        }
      }
      setNodes(converted.nodes);
      setEdges(converted.edges);
    }
  }, [initialFlow, setNodes, setEdges, layoutKey]);

  // Notify parent when flow changes (avoid expensive Zod validation until nodes are minimally ready)
  useEffect(() => {
    if (!onFlowChange || nodes.length === 0) return;

    const isObject = (v: unknown): v is Record<string, unknown> =>
      typeof v === "object" && v !== null;

    interface GenericData {
      title?: unknown;
      protocolId?: unknown;
      stepSpecification?: unknown;
    }

    const allReady = nodes.every((n) => {
      const data = n.data as GenericData;
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
        return typeof data.title === "string" && data.title.length > 0;
      }
      if (n.type === "INSTRUCTION") {
        const spec = data.stepSpecification as { text?: unknown } | undefined;
        if (isObject(spec) && typeof spec.text === "string" && spec.text.length > 0) {
          return true;
        }
        return typeof data.title === "string" && data.title.length > 0;
      }
      return true;
    });

    if (!allReady) return; // skip validation until ready

    try {
      const apiFormat = FlowMapper.toApiGraph(nodes, edges);
      onFlowChange(apiFormat);
    } catch (error) {
      // Reduce console spam by grouping (development only heuristic)
      console.warn("Flow conversion error (suppressed until ready):", error);
    }
  }, [nodes, edges, onFlowChange]);

  // Persist node positions (throttled by animation frame) whenever they change
  useEffect(() => {
    if (!layoutKey) return;
    if (typeof window === "undefined") return;
    // Only store id -> {x,y}
    const positions = Object.fromEntries(
      nodes.map((n) => [n.id, { x: n.position.x, y: n.position.y }]),
    );
    try {
      window.localStorage.setItem(layoutKey, JSON.stringify(positions));
    } catch {
      // storage may be full or disabled; ignore silently
    }
  }, [nodes, layoutKey]);

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
      if (selectedNode && selectedNode.id === nodeId) {
        setSelectedNode({ ...selectedNode, data: newData });
      }
    },
    [setNodes, selectedNode],
  );

  // Create node wrapper component
  const NodeWrapper = useCallback(
    (props: NodeProps) => (
      <BaseNode
        {...props}
        nodes={nodes}
        onNodeSelect={handleNodeSelect}
        onNodeDelete={handleNodeDelete}
      />
    ),
    [nodes, handleNodeSelect, handleNodeDelete],
  );

  // Node types configuration (memoized to avoid React Flow warning)
  const nodeTypes = useMemo(
    () =>
      ALL_NODE_TYPES.reduce(
        (map, type) => {
          map[type] = NodeWrapper;
          return map;
        },
        {} as Record<NodeType, React.ComponentType<NodeProps>>,
      ),
    [NodeWrapper],
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
      setNodes((nds) => {
        // If this is the very first node, mark it as the start node automatically
        if (nds.length === 0) {
          newNode.data = { ...newNode.data, isStartNode: true };
        }
        return [...nds, newNode];
      });
    },
    [setNodes],
  );

  // Apply edge styles based on selection
  const styledEdges = getStyledEdges(edges, selectedEdgeId);

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
    <>
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

      <Card>
        <CardHeader>
          <CardTitle>Experiment Flow Editor</CardTitle>
          <CardDescription>
            Design your experiment flow by dragging nodes from the legend and connecting them.
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
                    defaultViewport={{ x: 50, y: 150, zoom: 1 }}
                    defaultEdgeOptions={{
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
