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
  const isActive = selected ?? dragging;
  const accent = nodeType ? nodeTypeColorMap[nodeType].accent : "#94a3b8";

  return (
    <>
      {hasInput && (
        <div className={`absolute z-[10] ${getHandlePositionClasses(inputPosition)}`}>
          <Handle
            type="target"
            position={inputPosition}
            id="in"
            className={cn("!h-2 !w-2 !rounded-full !border transition-colors duration-150")}
            style={{
              backgroundColor: isActive ? "#FFFFFF" : "#FFFFFF",
              borderColor: isActive ? "#005e5e" : accent,
              borderWidth: isActive ? 2 : 1.5,
            }}
          />
        </div>
      )}
      {hasOutput && (
        <div className={`absolute z-[10] ${getHandlePositionClasses(outputPosition)}`}>
          <Handle
            type="source"
            position={outputPosition}
            id="out"
            className={cn("!h-2 !w-2 !rounded-full !border transition-colors duration-150")}
            style={{
              backgroundColor: isActive ? "#FFFFFF" : "#FFFFFF",
              borderColor: isActive ? "#005e5e" : accent,
              borderWidth: isActive ? 2 : 1.5,
            }}
          />
        </div>
      )}
    </>
  );
}
