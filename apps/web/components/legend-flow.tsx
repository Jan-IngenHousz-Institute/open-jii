import React from "react";

import { Card, CardHeader, CardTitle, CardContent } from "@repo/ui/components";

import type { NodeType } from "./react-flow/node-config";
import { nodeTypeColorMap } from "./react-flow/node-config";

export function LegendFlow() {
  const nodeTypes = Object.keys(nodeTypeColorMap) as NodeType[];

  return (
    <Card className="w-full max-w-full md:w-48">
      <CardHeader>
        <CardTitle>Legend</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3 md:flex md:flex-col md:gap-3">
        {nodeTypes.map((type) => {
          const colorClass = `${nodeTypeColorMap[type].border} ${nodeTypeColorMap[type].bg}`;
          const isComingSoon = false;
          const isDraggable = true;

          return (
            <div
              key={type}
              draggable={isDraggable}
              onDragStart={
                isDraggable
                  ? (e) => e.dataTransfer.setData("application/reactflow", type)
                  : undefined
              }
              role="button"
              tabIndex={0}
              className={`flex items-center rounded-lg border md:gap-2 ${colorClass} ${
                isDraggable
                  ? "cursor-grab transition-transform hover:scale-105"
                  : "cursor-not-allowed opacity-60"
              } gap-1 px-2 py-1 shadow-md md:py-2`}
            >
              {/* Icon */}
              <div className="text-slate-600">
                {React.cloneElement(
                  nodeTypeColorMap[type].icon as React.ReactElement,
                  { size: 20 } as Record<string, unknown>,
                )}
              </div>
              {/* Label */}
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  {type.charAt(0) + type.slice(1).toLowerCase()}
                </span>
                {isComingSoon && <span className="text-xs text-slate-500">Coming Soon</span>}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
