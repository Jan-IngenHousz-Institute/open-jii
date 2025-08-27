import { Position, Handle } from "@xyflow/react";
import React from "react";

import { cn } from "@repo/ui/lib/utils";

import { nodeTypeColorMap } from "../react-flow/node-config";
import type { NodeType } from "./node-config";

interface NodeHandlesProps {
  hasInput: boolean;
  hasOutput: boolean;
  inputPosition: Position;
  outputPosition: Position;
  selected?: boolean;
  dragging?: boolean;
  nodeType?: NodeType;
}

export const getHandlePositionClasses = (position: Position): string => {
  switch (position) {
    case Position.Left:
      return "left-0 top-1/2 -translate-y-1/2";
    case Position.Right:
      return "right-0 top-1/2 -translate-y-1/2";
    case Position.Top:
      return "left-1/2 top-0 -translate-x-1/2";
    case Position.Bottom:
      return "bottom-0 left-1/2 -translate-x-1/2";
    default:
      return "right-0 top-1/2 -translate-y-1/2";
  }
};

export function NodeHandles({
  hasInput,
  hasOutput,
  inputPosition,
  outputPosition,
  selected,
  dragging,
  nodeType,
}: NodeHandlesProps) {
  // Pick color classes from nodeTypeColorMap
  const highlightClass = "!border-jii-dark-green !bg-white";
  const colorClass =
    selected || dragging
      ? highlightClass
      : nodeType
        ? `${nodeTypeColorMap[nodeType].border} ${nodeTypeColorMap[nodeType].bg}`
        : "!border-slate-300 !bg-slate-100";

  return (
    <>
      {hasInput && (
        <div className={`absolute z-[10] ${getHandlePositionClasses(inputPosition)}`}>
          <Handle
            type="target"
            position={inputPosition}
            id="in"
            className={cn(
              "!h-[12px] !w-[12px] rounded-full border opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100",
              colorClass,
              (selected ?? dragging) && "opacity-100",
            )}
          />
        </div>
      )}
      {hasOutput && (
        <div className={`absolute z-[10] ${getHandlePositionClasses(outputPosition)}`}>
          <Handle
            type="source"
            position={outputPosition}
            id="out"
            className={cn(
              "!h-[12px] !w-[12px] rounded-full border opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100",
              colorClass,
              (selected ?? dragging) && "opacity-100",
            )}
          />
        </div>
      )}
    </>
  );
}
