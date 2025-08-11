import type { Node, NodeProps } from "@xyflow/react";
import { Position } from "@xyflow/react";
import React from "react";

import { cn } from "@repo/ui/lib/utils";

import { toPosition } from "./flow-utils";
import { nodeTypeColorMap } from "./node-config";
import type { NodeType } from "./node-config";
import { NodeContent } from "./node-content";

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
    // Find the actual node from the nodes array by id
    const node = nodes.find((n) => n.id === nodeProps.id) ?? null;
    if (onNodeSelect) onNodeSelect(node);
  };

  // Pass border color from color map
  const borderColor = nodeTypeColorMap[nodeProps.type as NodeType].border;

  return (
    <div onClick={isStatic ? undefined : handleSelect}>
      <div
        className={cn("group relative inline-block min-h-[60px] min-w-[120px] bg-transparent p-0")}
        tabIndex={isStatic ? undefined : 0}
      >
        {/* Delete button - only show if not static */}
        {!isStatic && (
          <button
            className={cn(
              "pointer-events-auto absolute right-1 top-1 z-20 h-5 w-5 cursor-pointer rounded-full p-0 text-center text-xs leading-[18px] opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100",
              (nodeProps.selected || nodeProps.dragging) && "opacity-100",
            )}
            title="Delete node"
            onClick={handleDelete}
            aria-label="Delete node"
          >
            <span className="text-[18px] font-bold leading-[18px]">×</span>
          </button>
        )}
        <div className="node-hover-area absolute inset-0 z-[9] rounded-xl" />
        <div
          className={cn(
            "bg-card text-card-foreground relative rounded-xl border-2 bg-gray-50 shadow-lg",
            nodeProps.selected || nodeProps.dragging
              ? "!border-jii-dark-green !bg-jii-dark-green/10 shadow-lg"
              : borderColor,
          )}
        >
          <NodeContent
            title={title}
            nodeType={nodeProps.type as NodeType}
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
