"use client";

import type { Node, Edge, Connection, ReactFlowInstance } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AlertCircle, Maximize2, Minimize2 } from "lucide-react";
import { useCallback, useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";

import type {
  ExperimentFlow,
  ExperimentUpsertFlowBody,
} from "@repo/api/domains/experiment/flows/experiment-flows.schema";
import type { BranchCell, WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import { cellsToFlowGraph, deriveFlowNodeName } from "@repo/api/transforms/cells-to-flow";
import { resolveBranchPathById } from "@repo/api/transforms/evaluate-branch";
import { flowNodesToWorkbookCells } from "@repo/api/transforms/flow-to-workbook-cells";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { cn } from "@repo/ui/lib/utils";

import { LegendFlow } from "../legend-flow";
import {
  connectFlowNodes,
  getReactFlowEdgeKind,
  getWorkbookCellInsertionIndex,
  getFlowData,
  handleNodesDeleteWithReconnection,
  handleNodeDrop,
} from "../react-flow/flow-utils";
import type { FlowRepairIssue } from "../react-flow/flow-utils";
import type { NodeType } from "../react-flow/node-config";
import { ALL_NODE_TYPES, getStyledEdges, nodeTypeColorMap } from "../react-flow/node-config";
import { FlowContextProvider, BaseNodeWrapper, ensureOneStartNode } from "../react-flow/node-utils";
import { ExperimentSidePanel } from "../side-panel-flow/side-panel-flow";
import { resolveBranchPathColor } from "../workbook/branch-path-colors";
import { autoLayout } from "./auto-layout";
import { BackEdge } from "./back-edge";
import { FlowMapper } from "./flow-mapper";
import { WorkbookCanvasModebar } from "./workbook-canvas-modebar";
import {
  mergePanelDataIntoWorkbookCell,
  mergePanelTitleIntoWorkbookCell,
} from "./workbook-cell-panel-merge";

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
  workbookCells?: WorkbookCell[];
  onWorkbookCellsChange?: (cells: WorkbookCell[]) => void;
  onNodeSelect?: (node: Node | null) => void;
  onDirtyChange?: (dirty: boolean) => void; // notify parent that there are unsaved changes
  isDisabled?: boolean; // whether the flow is read-only
}

export const FlowEditor = forwardRef<FlowEditorHandle, FlowEditorProps>(
  (
    {
      initialFlow,
      workbookCells,
      onWorkbookCellsChange,
      onNodeSelect,
      onDirtyChange,
      isDisabled = false,
    },
    ref,
  ) => {
    // State for selected edge and node
    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [repairIssues, setRepairIssues] = useState<FlowRepairIssue[]>([]);
    const [structuralError, setStructuralError] = useState<string | null>(null);
    const [pendingCell, setPendingCell] = useState<WorkbookCell | null>(null);
    const workbookCellsRef = useRef(workbookCells);
    const writebackRequestedRef = useRef(false);
    const flowInstanceRef = useRef<ReactFlowInstance | null>(null);
    workbookCellsRef.current = workbookCells;

    const initialData = initialFlow
      ? FlowMapper.toReactFlow(initialFlow)
      : { nodes: [], edges: [] };
    if (isDisabled && initialData.nodes.length > 0) {
      initialData.nodes = autoLayout(initialData.nodes, initialData.edges);
    }

    const [nodes, setNodes, onNodesChange] = useNodesState(initialData.nodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialData.edges);

    useEffect(() => {
      if (!writebackRequestedRef.current || !onWorkbookCellsChange || !workbookCellsRef.current)
        return;
      try {
        const graph = FlowMapper.toApiGraph(nodes, edges);
        const nextCells = flowNodesToWorkbookCells(
          graph.nodes,
          graph.edges,
          workbookCellsRef.current,
        );
        writebackRequestedRef.current = false;
        setStructuralError(null);
        if (JSON.stringify(nextCells) !== JSON.stringify(workbookCellsRef.current)) {
          workbookCellsRef.current = nextCells;
          onWorkbookCellsChange(nextCells);
        }
      } catch (error) {
        setStructuralError(
          error instanceof Error ? error.message : "The flow structure is invalid.",
        );
      }
    }, [nodes, edges, onWorkbookCellsChange]);

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
        writebackRequestedRef.current = true;
        setEdges((eds) => {
          const result = handleNodesDeleteWithReconnection(deleted, nodes, eds);
          setRepairIssues(result.issues);
          return result.edges;
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

    const updateDraftCell = useCallback(
      (nodeId: string, update: (cell: WorkbookCell) => WorkbookCell) => {
        const currentCells = workbookCellsRef.current;
        if (!currentCells || !onWorkbookCellsChange) return;
        const nextCells = currentCells.map((cell) => (cell.id === nodeId ? update(cell) : cell));
        if (JSON.stringify(nextCells) === JSON.stringify(currentCells)) return;
        workbookCellsRef.current = nextCells;
        onWorkbookCellsChange(nextCells);
      },
      [onWorkbookCellsChange],
    );

    // Handle node title changes
    const handleTitleChange = useCallback(
      (newTitle: string) => {
        if (selectedNode) {
          const cell = workbookCellsRef.current?.find(
            (candidate) => candidate.id === selectedNode.id,
          );
          const safeTitle = cell ? deriveFlowNodeName(cell, newTitle) : newTitle.slice(0, 64);
          updateDraftCell(selectedNode.id, (cell) =>
            mergePanelTitleIntoWorkbookCell(cell, newTitle),
          );
          setNodes((nds) =>
            nds.map((node) =>
              node.id === selectedNode.id
                ? { ...node, data: { ...node.data, title: safeTitle } }
                : node,
            ),
          );
          setSelectedNode((prevNode) =>
            prevNode ? { ...prevNode, data: { ...prevNode.data, title: safeTitle } } : null,
          );
        }
      },
      [selectedNode, setNodes, updateDraftCell],
    );

    // Handle edge updates
    const handleEdgeUpdate = useCallback(
      (edgeId: string, updates: Partial<Edge>) => {
        const edge = edges.find((candidate) => candidate.id === edgeId);
        const nextLabel = updates.data?.label;
        if (
          edge &&
          getReactFlowEdgeKind(edge) === "branch" &&
          edge.sourceHandle &&
          typeof nextLabel === "string"
        ) {
          const branchCell = workbookCellsRef.current?.find((cell) => cell.id === edge.source);
          const cellPathResolution =
            branchCell?.type === "branch"
              ? resolveBranchPathById(branchCell.paths, edge.sourceHandle)
              : { status: "absent" as const };
          const branchNode = nodes.find((node) => node.id === edge.source);
          const specification = branchNode?.data.stepSpecification as
            | { paths?: { id: string; label: string; color: string }[] }
            | undefined;
          const nodePathResolution = resolveBranchPathById(
            specification?.paths ?? [],
            edge.sourceHandle,
          );
          if (
            cellPathResolution.status !== "resolved" ||
            nodePathResolution.status !== "resolved"
          ) {
            setStructuralError(
              `Branch path "${edge.sourceHandle}" is ${
                cellPathResolution.status === "ambiguous" ||
                nodePathResolution.status === "ambiguous"
                  ? "ambiguous"
                  : "missing"
              }. Open the branch node settings and edit the intended path there.`,
            );
            return;
          }
          const cellPath = cellPathResolution.path;
          const nodePath = nodePathResolution.path;
          setStructuralError(null);
          updateDraftCell(edge.source, (cell) => {
            if (cell.type !== "branch") return cell;
            return {
              ...cell,
              paths: cell.paths.map((path) =>
                path === cellPath ? { ...path, label: nextLabel } : path,
              ),
            };
          });
          setNodes((current) =>
            current.map((node) => {
              if (node.id !== edge.source) return node;
              if (!specification?.paths) return node;
              return {
                ...node,
                data: {
                  ...node.data,
                  stepSpecification: {
                    ...specification,
                    paths: specification.paths.map((path) =>
                      path === nodePath ? { ...path, label: nextLabel } : path,
                    ),
                  },
                },
              };
            }),
          );
        }
        setEdges((eds) => eds.map((edge) => (edge.id === edgeId ? { ...edge, ...updates } : edge)));
      },
      [edges, nodes, setEdges, setNodes, updateDraftCell],
    );

    // Handle edge deletion
    const handleEdgeDelete = useCallback(
      (edgeId: string) => {
        setEdges((eds) => {
          const edge = eds.find((candidate) => candidate.id === edgeId);
          if (!edge || getReactFlowEdgeKind(edge) !== "branch") return eds;
          writebackRequestedRef.current = true;
          return eds.filter((candidate) => candidate.id !== edgeId);
        });
        setSelectedEdgeId(null);
      },
      [setEdges],
    );

    // Handle node data changes
    const handleNodeDataChange = useCallback(
      (nodeId: string, newData: Record<string, unknown>) => {
        updateDraftCell(nodeId, (cell) => mergePanelDataIntoWorkbookCell(cell, newData));
        setNodes((nds) =>
          nds.map((node) => (node.id === nodeId ? { ...node, data: newData } : node)),
        );
        // Update selected node if it's the same node being changed
        setSelectedNode((prevSelected) =>
          prevSelected?.id === nodeId ? { ...prevSelected, data: newData } : prevSelected,
        );
      },
      [setNodes, updateDraftCell],
    );

    const handleBranchCellChange = useCallback(
      (updated: BranchCell) => {
        const currentCells = workbookCellsRef.current;
        if (!currentCells || !onWorkbookCellsChange) return;
        const nextCells = currentCells.map((cell) => (cell.id === updated.id ? updated : cell));
        workbookCellsRef.current = nextCells;
        onWorkbookCellsChange(nextCells);

        const stepSpecification = {
          paths: updated.paths.map((path) => ({
            id: path.id,
            label: path.label,
            color: path.color,
          })),
          defaultPathId: updated.defaultPathId,
        };
        setNodes((current) =>
          current.map((node) =>
            node.id === updated.id ? { ...node, data: { ...node.data, stepSpecification } } : node,
          ),
        );
        setSelectedNode((current) =>
          current?.id === updated.id
            ? { ...current, data: { ...current.data, stepSpecification } }
            : current,
        );
        setEdges((current) => [
          ...current.filter(
            (edge) => !(edge.source === updated.id && edge.data?.kind === "branch"),
          ),
          ...updated.paths.flatMap((path) =>
            path.gotoCellId
              ? [
                  {
                    id: `e-${updated.id}-${path.id}-${path.gotoCellId}`,
                    source: updated.id,
                    target: path.gotoCellId,
                    sourceHandle: path.id,
                    targetHandle: "in",
                    data: { kind: "branch", label: path.label },
                  } satisfies Edge,
                ]
              : [],
          ),
        ]);
      },
      [onWorkbookCellsChange, setEdges, setNodes],
    );

    // Edge creation
    const onConnect = useCallback(
      (params: Connection) => {
        if (isDisabled) return; // No connections in disabled mode
        try {
          const result = connectFlowNodes(params, nodes, edges);
          writebackRequestedRef.current = true;
          setNodes(result.nodes);
          setEdges(result.edges);
          setStructuralError(null);
        } catch (error) {
          setStructuralError(
            error instanceof Error ? error.message : "The flow structure is invalid.",
          );
        }
      },
      [nodes, edges, setNodes, setEdges, isDisabled],
    );

    // Edge selection
    const onEdgeClick = useCallback((e: React.MouseEvent, edge: Edge) => {
      e.stopPropagation();
      setSelectedEdgeId(edge.id);
      setSelectedNode(null);
    }, []);

    // Pane click (deselect)
    const placePendingCell = useCallback(
      (position: { x: number; y: number }) => {
        const currentCells = workbookCellsRef.current;
        if (!pendingCell || !currentCells || !onWorkbookCellsChange) return;

        const insertAt = getWorkbookCellInsertionIndex(currentCells, nodes, position.x);
        const nextCells = [...currentCells];
        nextCells.splice(insertAt, 0, pendingCell);

        const graph = cellsToFlowGraph(nextCells);
        const now = new Date().toISOString();
        const converted = FlowMapper.toReactFlow({
          id: "derived-draft",
          experimentId: initialFlow?.experimentId ?? "derived",
          graph,
          createdAt: now,
          updatedAt: now,
        });
        const positionsById = new Map(nodes.map((node) => [node.id, node.position]));
        setNodes(
          converted.nodes.map((node) => ({
            ...node,
            position:
              node.id === pendingCell.id ? position : (positionsById.get(node.id) ?? node.position),
          })),
        );
        setEdges(converted.edges);
        workbookCellsRef.current = nextCells;
        onWorkbookCellsChange(nextCells);
        setPendingCell(null);
        setStructuralError(null);
      },
      [initialFlow?.experimentId, nodes, onWorkbookCellsChange, pendingCell, setEdges, setNodes],
    );

    const onPaneClick = useCallback(
      (event?: React.MouseEvent) => {
        if (pendingCell && event) {
          const position = flowInstanceRef.current?.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          });
          if (position) placePendingCell(position);
          return;
        }
        setSelectedEdgeId(null);
        setSelectedNode(null);
      },
      [pendingCell, placePendingCell],
    );

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
        const resolvedPath = resolveBranchPathById(paths, path.id);
        if (resolvedPath.status === "resolved") {
          branchPathColors.set(
            `${node.id}:${path.id}`,
            resolveBranchPathColor(resolvedPath.path.color, resolvedPath.path.id),
          );
        }
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
          deletable: !isDisabled && getReactFlowEdgeKind(edge) === "branch",
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
      setNodes((nds) => ensureOneStartNode(nds, edges));
    }, [nodes.length, edges, setNodes]);

    const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) ?? null;
    const selectedEdgeIsDeletable =
      !!selectedEdge && getReactFlowEdgeKind(selectedEdge) === "branch";
    const selectedWorkbookCell = selectedNode
      ? workbookCellsRef.current?.find((cell) => cell.id === selectedNode.id)
      : undefined;
    const rawNodeTitle = (() => {
      switch (selectedWorkbookCell?.type) {
        case "protocol":
        case "macro":
        case "command":
          return selectedWorkbookCell.payload.name;
        case "question":
          return selectedWorkbookCell.name;
        default:
          return undefined;
      }
    })();

    return (
      <div>
        {/* Side panel for nodes and edges */}
        <ExperimentSidePanel
          open={!!selectedNode || !!selectedEdgeId}
          selectedNode={selectedNode}
          nodeType={selectedNode?.type}
          nodeTitle={
            rawNodeTitle ??
            (typeof selectedNode?.data.title === "string" ? selectedNode.data.title : undefined)
          }
          onClose={() => {
            setSelectedNode(null);
            setSelectedEdgeId(null);
          }}
          onTitleChange={isDisabled ? undefined : handleTitleChange}
          onNodeDataChange={isDisabled ? undefined : handleNodeDataChange}
          selectedEdge={selectedEdge}
          onEdgeUpdate={isDisabled ? undefined : handleEdgeUpdate}
          onEdgeDelete={isDisabled || !selectedEdgeIsDeletable ? undefined : handleEdgeDelete}
          nodes={nodes}
          edges={edges}
          isDisabled={isDisabled}
          branchCell={
            selectedNode
              ? (workbookCellsRef.current?.find(
                  (cell): cell is BranchCell =>
                    cell.id === selectedNode.id && cell.type === "branch",
                ) ?? undefined)
              : undefined
          }
          workbookCells={workbookCellsRef.current}
          onBranchCellChange={isDisabled ? undefined : handleBranchCellChange}
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
                    onDragOver={
                      isDisabled || workbookCellsRef.current ? undefined : (e) => e.preventDefault()
                    }
                    onDrop={isDisabled || workbookCellsRef.current ? undefined : handleDrop}
                  >
                    {/* Fullscreen controls overlay */}
                    {structuralError && (
                      <div
                        role="alert"
                        className="border-destructive/30 bg-background text-destructive fixed left-1/2 top-4 z-[100] flex max-w-md -translate-x-1/2 gap-2 rounded-md border px-3 py-2 text-xs shadow-md"
                      >
                        <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                        <span>{structuralError}</span>
                      </div>
                    )}
                    {repairIssues.length > 0 && (
                      <div
                        role="alert"
                        className="border-destructive/30 bg-background text-destructive absolute left-4 top-4 z-10 flex max-w-md gap-2 rounded-md border px-3 py-2 text-xs shadow-sm"
                      >
                        <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
                        <span>
                          {repairIssues.length === 1
                            ? "A branch target was deleted and cleared. You can choose a new target."
                            : `${repairIssues.length} branch targets were deleted and cleared. You can choose new targets.`}
                        </span>
                      </div>
                    )}
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
                        onInit={(instance) => {
                          flowInstanceRef.current = instance;
                        }}
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

                    {!isDisabled && workbookCellsRef.current && (
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 [&_[data-toolbar-shell]]:pointer-events-auto">
                        <WorkbookCanvasModebar
                          visible={!selectedNode && !selectedEdgeId}
                          existingCells={workbookCellsRef.current}
                          pendingCell={pendingCell}
                          onArmCell={setPendingCell}
                          onCursor={() => setPendingCell(null)}
                        />
                      </div>
                    )}

                    {/* Overlay legend always, except on small screens and when disabled */}
                    {!isDisabled && !workbookCellsRef.current && (
                      <div className="hidden md:block">
                        <LegendFlow overlay />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Legend below on small screens - hide in disabled mode */}
              {!isDisabled && !workbookCellsRef.current && (
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
