import type { Node, Edge, NodeProps, Connection } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";
import {
  ReactFlow,
  addEdge,
  Position,
  useNodesState,
  useEdgesState,
  getIncomers,
  getOutgoers,
  getConnectedEdges,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { FileInput, BookText, HelpCircle, Cpu, BarChart2 } from "lucide-react";
import { useCallback, useState, useMemo } from "react";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@repo/ui/components";

import { BaseHandle } from "../base-handle";
import { BaseNode, BaseNodeContent } from "../base-node";
import { LegendFlow } from "../legend-flow";
import { ExperimentSidePanel } from "../side-panel-flow";

export function NewExperimentFlow({
  onNodeSelect,
}: {
  onNodeSelect?: (node: Node | null) => void;
}) {
  // State for selected edge
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // 1) A helper to convert "left"/"right"/etc into Position enum
  function toPosition(pos?: string | Position): Position | undefined {
    if (!pos) return undefined;
    if (typeof pos !== "string") return pos;
    switch (pos.toLowerCase()) {
      case "left":
        return Position.Left;
      case "right":
        return Position.Right;
      case "top":
        return Position.Top;
      case "bottom":
        return Position.Bottom;
      default:
        return undefined;
    }
  }

  // 2) Define a “raw” node type that lets you use strings…
  type RawNode = Omit<Node, "sourcePosition" | "targetPosition"> & {
    sourcePosition?: string | Position;
    targetPosition?: string | Position;
  };

  // Node type color map (border/bg) and icons
  type NodeType = "input" | "instruction" | "question" | "measurement" | "analysis";
  const nodeTypeColorMap: Record<NodeType, { border: string; bg: string; icon: React.ReactNode }> =
    useMemo(
      () => ({
        input: {
          border: "!border-blue-400",
          bg: "!bg-blue-50",
          icon: <FileInput size={32} strokeWidth={2} />,
        },
        instruction: {
          border: "!border-yellow-400",
          bg: "!bg-yellow-50",
          icon: <BookText size={32} strokeWidth={2} />,
        },
        question: {
          border: "!border-purple-400",
          bg: "!bg-purple-50",
          icon: <HelpCircle size={32} strokeWidth={2} />,
        },
        measurement: {
          border: "!border-green-400",
          bg: "!bg-green-50",
          icon: <Cpu size={32} strokeWidth={2} />,
        },
        analysis: {
          border: "!border-red-400",
          bg: "!bg-red-50",
          icon: <BarChart2 size={32} strokeWidth={2} />,
        },
      }),
      [],
    );

  // === Horizontal flow with current node types and labels ===
  const initialNodes: RawNode[] = [
    {
      id: "horizontal-1",
      type: "input",
      data: { label: "Input" },
      position: { x: 0, y: 100 },
      sourcePosition: "right",
    },
    {
      id: "horizontal-2",
      type: "instruction",
      data: { label: "Instruction" },
      position: { x: 400, y: 0 },
      sourcePosition: "right",
      targetPosition: "left",
    },
    {
      id: "horizontal-3",
      type: "analysis",
      data: { label: "Analysis" },
      position: { x: 400, y: 220 },
      sourcePosition: "right",
      targetPosition: "left",
    },
    {
      id: "horizontal-4",
      type: "measurement",
      data: { label: "Measurement" },
      position: { x: 850, y: 0 },
      sourcePosition: "right",
      targetPosition: "left",
    },
    {
      id: "horizontal-5",
      type: "question",
      data: { label: "Question" },
      position: { x: 1050, y: 200 },
      sourcePosition: "top",
      targetPosition: "bottom",
    },
    {
      id: "horizontal-6",
      type: "analysis",
      data: { label: "Analysis 2" },
      position: { x: 850, y: 400 },
      sourcePosition: "bottom",
      targetPosition: "top",
    },
    {
      id: "horizontal-7",
      type: "measurement",
      data: { label: "Measurement 2" },
      position: { x: 1300, y: 100 },
      sourcePosition: "right",
      targetPosition: "left",
    },
    {
      id: "horizontal-8",
      type: "question",
      data: { label: "Question 2" },
      position: { x: 1300, y: 400 },
      sourcePosition: "right",
      targetPosition: "left",
    },
  ];

  const initialEdges: Edge[] = [
    {
      id: "horizontal-e1-2",
      source: "horizontal-1",
      type: "smoothstep",
      target: "horizontal-2",
      animated: true,
    },
    {
      id: "horizontal-e1-3",
      source: "horizontal-1",
      type: "smoothstep",
      target: "horizontal-3",
      animated: true,
    },
    {
      id: "horizontal-e1-4",
      source: "horizontal-2",
      type: "smoothstep",
      target: "horizontal-4",
      label: "edge label",
    },
    {
      id: "horizontal-e3-5",
      source: "horizontal-3",
      type: "smoothstep",
      target: "horizontal-5",
      animated: true,
    },
    {
      id: "horizontal-e3-6",
      source: "horizontal-3",
      type: "smoothstep",
      target: "horizontal-6",
      animated: true,
    },
    {
      id: "horizontal-e5-7",
      source: "horizontal-5",
      type: "smoothstep",
      target: "horizontal-7",
      animated: true,
    },
    {
      id: "horizontal-e6-8",
      source: "horizontal-6",
      type: "smoothstep",
      target: "horizontal-8",
      animated: true,
    },
  ];

  const processedInitialNodes: Node[] = initialNodes.map((n) => ({
    ...n,
    sourcePosition: toPosition(n.sourcePosition),
    targetPosition: toPosition(n.targetPosition),
  }));

  const [nodes, setNodes, onNodesChange] = useNodesState(processedInitialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Helpers to compute handle positions (accept Position enum or string)
  const getHandlePositions = useCallback((src?: Position | string, tgt?: Position | string) => {
    // Normalize to string for comparison, handle undefined/null
    const srcStr = src ? (typeof src === "string" ? src : String(src).toLowerCase()) : undefined;
    const tgtStr = tgt ? (typeof tgt === "string" ? tgt : String(tgt).toLowerCase()) : undefined;
    return {
      hasInput: !!tgt,
      hasOutput: !!src,
      inputPosition:
        tgtStr === "left"
          ? Position.Left
          : tgtStr === "right"
            ? Position.Right
            : tgtStr === "top"
              ? Position.Top
              : tgtStr === "bottom"
                ? Position.Bottom
                : Position.Left,
      outputPosition:
        srcStr === "left"
          ? Position.Left
          : srcStr === "right"
            ? Position.Right
            : srcStr === "top"
              ? Position.Top
              : srcStr === "bottom"
                ? Position.Bottom
                : Position.Right,
    };
  }, []);

  // Render input/output handles
  const createHandles = useCallback(
    (
      hasIn: boolean,
      hasOut: boolean,
      inPos: Position,
      outPos: Position,
      sel: boolean | undefined,
      drag: boolean | undefined,
      nodeType?: NodeType,
    ) => {
      // Pick color classes from nodeTypeColorMap
      const highlightClass = "!border-jii-dark-green !bg-white";
      const colorClass =
        sel || drag
          ? highlightClass
          : nodeType
            ? `${nodeTypeColorMap[nodeType].border} ${nodeTypeColorMap[nodeType].bg}`
            : "!border-slate-300 !bg-slate-100";
      return (
        <>
          {hasIn && (
            <div
              className={`absolute z-[10] ${
                inPos === Position.Left
                  ? "left-0 top-1/2 -translate-y-1/2"
                  : inPos === Position.Right
                    ? "right-0 top-1/2 -translate-y-1/2"
                    : inPos === Position.Top
                      ? "left-1/2 top-0 -translate-x-1/2"
                      : "bottom-0 left-1/2 -translate-x-1/2"
              }`}
            >
              <BaseHandle
                type="target"
                position={inPos}
                id="in"
                selected={sel}
                dragging={drag}
                colorClass={colorClass}
              />
            </div>
          )}
          {hasOut && (
            <div
              className={`absolute z-[10] ${
                outPos === Position.Left
                  ? "left-0 top-1/2 -translate-y-1/2"
                  : outPos === Position.Right
                    ? "right-0 top-1/2 -translate-y-1/2"
                    : outPos === Position.Top
                      ? "left-1/2 top-0 -translate-x-1/2"
                      : "bottom-0 left-1/2 -translate-x-1/2"
              }`}
            >
              <BaseHandle
                type="source"
                position={outPos}
                id="out"
                selected={sel}
                dragging={drag}
                colorClass={colorClass}
              />
            </div>
          )}
        </>
      );
    },
    [nodeTypeColorMap],
  );

  // Node content inside BaseNode
  const createNodeContent = useCallback(
    (
      label: string,
      nodeType: NodeType,
      hasIn: boolean,
      hasOut: boolean,
      inPos: Position,
      outPos: Position,
      sel?: boolean,
      drag?: boolean,
    ) => (
      <>
        {createHandles(hasIn, hasOut, inPos, outPos, sel, drag, nodeType)}
        <BaseNodeContent>
          <div className="flex flex-col items-center justify-center p-3">
            {/* Icon */}
            <div className={`${sel ? "text-jii-dark-green" : "text-slate-600"} mb-1`}>
              {nodeTypeColorMap[nodeType].icon}
            </div>
            {/* Label inside the node */}
            <div className="text-center">
              <span className="text-md font-medium text-slate-700">{label}</span>
            </div>
          </div>
        </BaseNodeContent>
      </>
    ),
    [createHandles, nodeTypeColorMap],
  );

  // Delete logic and reconnection
  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      setEdges((eds) => {
        // Start the reducer with the existing edges, and type the accumulator:
        const updatedEdges = deleted.reduce<Edge[]>((acc, node) => {
          const incomers = getIncomers(node, nodes, acc);
          const outgoers = getOutgoers(node, nodes, acc);
          const connected = getConnectedEdges([node], acc);

          // Drop edges touching this node
          const filtered = acc.filter((e) => !connected.includes(e));

          // Reconnect incomers → outgoers
          const reconnected = incomers.flatMap(({ id: s }) =>
            outgoers.map(({ id: t }) => {
              const wasAnimated = connected.some((e) =>
                (e.source === s && e.target === node.id) || (e.source === node.id && e.target === t)
                  ? e.animated
                  : false,
              );
              return {
                id: `${s}->${t}`,
                source: s,
                target: t,
                type: "smoothstep" as const,
                markerEnd: { type: MarkerType.ArrowClosed },
                animated: wasAnimated,
              };
            }),
          );

          // Return the new edge list
          return [...filtered, ...reconnected];
        }, eds);
        return updatedEdges;
      });
    },
    [nodes, setEdges],
  );

  // Node wrapper
  const CustomNodeWrapper = useCallback(
    (props: NodeProps) => {
      const { label } = props.data as { label: string };
      const { sourcePosition, targetPosition } = props;
      const { hasInput, hasOutput, inputPosition, outputPosition } = getHandlePositions(
        sourcePosition,
        targetPosition,
      );
      const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        setNodes((nds) => {
          const toDel = nds.find((n) => n.id === props.id);
          if (toDel) onNodesDelete([toDel]);
          return nds.filter((n) => n.id !== props.id);
        });
      };
      const handleSelect = () => {
        // Find the actual node from the nodes array by id
        const node = nodes.find((n) => n.id === props.id) ?? null;
        setSelectedNode(node);
        if (onNodeSelect) onNodeSelect(node);
      };

      // Pass border color from color map
      const borderColor = nodeTypeColorMap[props.type as NodeType].border;

      return (
        <div onClick={handleSelect}>
          <BaseNode
            selected={props.selected}
            dragging={props.dragging}
            onDelete={handleDelete}
            nodeType={props.type}
            borderColor={borderColor}
          >
            {createNodeContent(
              label,
              props.type as NodeType,
              hasInput,
              hasOutput,
              inputPosition,
              outputPosition,
              props.selected,
              props.dragging,
            )}
          </BaseNode>
        </div>
      );
    },
    [
      getHandlePositions,
      nodeTypeColorMap,
      createNodeContent,
      setNodes,
      onNodesDelete,
      nodes,
      onNodeSelect,
    ],
  );

  const nodeTypes = {
    input: CustomNodeWrapper,
    instruction: CustomNodeWrapper,
    question: CustomNodeWrapper,
    measurement: CustomNodeWrapper,
    analysis: CustomNodeWrapper,
  };

  // Edge creation & highlighting
  const onConnect = useCallback(
    (params: Connection) => {
      // prevent self‑loops
      if (params.source === params.target) return;

      // generate a unique ID however you like
      const id = `e-${params.source}-${params.target}-${Date.now()}`;

      // build a fully‑typed Edge
      const newEdge: Edge = {
        id,
        source: params.source,
        target: params.target,
        // preserve any handle if present
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

  const onEdgeClick = useCallback((e: React.MouseEvent, edge: Edge) => {
    e.stopPropagation();
    setSelectedEdgeId(edge.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedEdgeId(null);
    setSelectedNode(null); // Also clear selected node when clicking on pane
  }, []);

  const edgesWithStyles = edges.map((edge) =>
    edge.id === selectedEdgeId
      ? { ...edge, style: { ...(edge.style ?? {}), stroke: "#49e06d", strokeWidth: 2 } }
      : { ...edge, style: { ...(edge.style ?? {}), stroke: "#005e5e", strokeWidth: 2 } },
  );

  return (
    <>
      {/* Side panel for instruction/question nodes */}
      <ExperimentSidePanel
        open={
          !!selectedNode &&
          (selectedNode.type === "instruction" || selectedNode.type === "question")
        }
        nodeType={selectedNode?.type}
        nodeLabel={
          typeof selectedNode?.data.label === "string" ? selectedNode.data.label : undefined
        }
        onClose={() => setSelectedNode(null)}
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
                  onDrop={(e) => {
                    e.preventDefault();
                    const type = e.dataTransfer.getData("application/reactflow");
                    if (!type) return;
                    const bounds = e.currentTarget.getBoundingClientRect();
                    const pos = { x: e.clientX - bounds.left, y: e.clientY - bounds.top };
                    // For instruction, question, measurement, analysis: handles on both sides
                    let sourcePosition: Position | undefined = undefined;
                    let targetPosition: Position | undefined = undefined;
                    if (["instruction", "question", "measurement", "analysis"].includes(type)) {
                      sourcePosition = Position.Right;
                      targetPosition = Position.Left;
                    } else if (type === "input") {
                      sourcePosition = Position.Right;
                    }
                    setNodes((nds) => [
                      ...nds,
                      {
                        id: `node_${Date.now()}`,
                        type,
                        position: pos,
                        ...(sourcePosition ? { sourcePosition } : {}),
                        ...(targetPosition ? { targetPosition } : {}),
                        data: { label: `${type.charAt(0).toUpperCase() + type.slice(1)} Node` },
                      },
                    ]);
                  }}
                >
                  <ReactFlow
                    nodes={nodes}
                    edges={edgesWithStyles}
                    onNodesChange={onNodesChange}
                    onNodesDelete={onNodesDelete}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onEdgeClick={onEdgeClick}
                    onPaneClick={onPaneClick}
                    nodeTypes={nodeTypes}
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
            <Card className="w-48">
              <CardHeader>
                <CardTitle>Legend</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <LegendFlow
                  nodeTypeColorMap={nodeTypeColorMap}
                  selectedEdgeId={selectedEdgeId}
                  edges={edges}
                  setEdges={setEdges}
                />
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
