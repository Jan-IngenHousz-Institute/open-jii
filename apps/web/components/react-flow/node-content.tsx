import type { Position } from "@xyflow/react";
import React from "react";

import { cn } from "@repo/ui/lib/utils";

import { nodeTypeColorMap } from "../react-flow/node-config";
import type { NodeType } from "./node-config";
import { NodeHandles } from "./node-handles";

interface NodeContentProps {
  title: string;
  nodeType: NodeType;
  hasInput: boolean;
  hasOutput: boolean;
  inputPosition: Position;
  outputPosition: Position;
  selected?: boolean;
  dragging?: boolean;
}

export function NodeContent({
  title,
  nodeType,
  hasInput,
  hasOutput,
  inputPosition,
  outputPosition,
  selected,
  dragging,
}: NodeContentProps) {
  return (
    <>
      <NodeHandles
        hasInput={hasInput}
        hasOutput={hasOutput}
        inputPosition={inputPosition}
        outputPosition={outputPosition}
        selected={selected}
        dragging={dragging}
        nodeType={nodeType}
      />
      <div className={cn("flex flex-col gap-y-2 p-3")}>
        <div className="flex flex-col items-center justify-center p-3">
          {/* Icon */}
          <div className={`${selected ? "text-jii-dark-green" : "text-slate-600"} mb-1`}>
            {nodeTypeColorMap[nodeType].icon}
          </div>
          {/* Label inside the node */}
          <div className="text-center">
            <span
              className="text-md inline-block max-w-[250px] truncate font-medium text-slate-700"
              title={title}
            >
              {title}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
