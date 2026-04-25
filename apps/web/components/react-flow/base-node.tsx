import type { Node, NodeProps } from "@xyflow/react";
import { Position } from "@xyflow/react";
import React from "react";

import { cn } from "@repo/ui/lib/utils";

import { nodeTypeColorMap } from "./node-config";
import type { NodeType } from "./node-config";
import { NodeContent } from "./node-content";
import { toPosition } from "./node-utils";

interface BaseNodeProps extends NodeProps {
  nodes: Node[];
  onNodeSelect?: (node: Node | null) => void;
  onNodeDelete: (nodeId: string) => void;
  isStatic?: boolean;
}

export const getHandlePositions = (src?: Position | string, tgt?: Position | string) => {
  // Normalize to string for comparison, handle undefined/null
  const srcStr = src ? src.toString().toLowerCase() : undefined;
  const tgtStr = tgt ? tgt.toString().toLowerCase() : undefined;

  return {
    hasInput: !!tgt,
    hasOutput: !!src,
    inputPosition: toPosition(tgtStr) ?? Position.Left,
    outputPosition: toPosition(srcStr) ?? Position.Right,
  };
};

export function BaseNode(props: BaseNodeProps) {
  const { nodes, onNodeSelect, onNodeDelete, isStatic = false, ...nodeProps } = props;
  const { title, isStartNode } = nodeProps.data as {
    title: string;
    isStartNode?: boolean;
  };
  const { sourcePosition, targetPosition } = nodeProps;

  const { hasInput, hasOutput, inputPosition, outputPosition } = getHandlePositions(
    sourcePosition,
    targetPosition,
  );

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNodeDelete(nodeProps.id);
  };

  const handleSelect = () => {
    const node = nodes.find((n) => n.id === nodeProps.id) ?? null;
    if (onNodeSelect) onNodeSelect(node);
  };

  const nodeType = nodeProps.type as NodeType;
  const accent = nodeTypeColorMap[nodeType].accent;
  const isActive = nodeProps.selected || nodeProps.dragging;

  return (
    <div onClick={handleSelect}>
      <div
        className={cn("group relative inline-block min-w-[160px] max-w-[220px] bg-transparent p-0")}
        tabIndex={0}
      >
        {/* Delete button - only show if not static */}
        {!isStatic && (
          <button
            className={cn(
              "pointer-events-auto absolute -right-2 -top-2 z-20 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-white text-xs opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100",
              isActive && "opacity-100",
            )}
            style={{
              border: `1px solid #EDF2F6`,
              color: "#68737B",
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            }}
            title="Delete node"
            onClick={handleDelete}
            aria-label="Delete node"
          >
            <span className="text-[13px] font-medium leading-none">×</span>
          </button>
        )}
        <div className="node-hover-area absolute inset-0 z-[9] rounded-[10px]" />
        <div
          data-testid="node-card"
          className={cn(
            "relative overflow-hidden rounded-[10px] transition-shadow duration-150",
            isActive && "ring-jii-dark-green ring-2",
          )}
          style={{
            backgroundColor: "#FFFFFF",
            border: `1px solid ${isActive ? "#005e5e" : "#EDF2F6"}`,
            boxShadow: isActive
              ? "inset 0px 2px 16px rgba(0, 94, 94, 0.10), 0px 6px 12px -2px rgba(0, 0, 0, 0.10)"
              : "inset 0px 2px 16px rgba(0, 94, 94, 0.08), 0px 4px 8px -2px rgba(0, 0, 0, 0.06)",
          }}
        >
          {/* Left accent bar — matches CellWrapper pattern */}
          <div className="absolute bottom-0 left-0 top-0 w-1" style={{ backgroundColor: accent }} />
          <NodeContent
            title={title}
            nodeType={nodeType}
            hasInput={hasInput}
            hasOutput={hasOutput}
            inputPosition={inputPosition}
            outputPosition={outputPosition}
            selected={nodeProps.selected}
            dragging={nodeProps.dragging}
            isStartNode={isStartNode}
          />
        </div>
      </div>
    </div>
  );
}
