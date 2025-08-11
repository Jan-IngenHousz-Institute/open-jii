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
          return (
            <div
              key={type}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("application/reactflow", type)}
              role="button"
              tabIndex={0}
              className={`flex items-center rounded-lg border md:gap-2 ${colorClass} cursor-grab gap-1 px-2 py-1 shadow-md transition-transform hover:scale-105 md:py-2`}
            >
              <div className="text-slate-600">
                {React.cloneElement(
                  nodeTypeColorMap[type].icon as React.ReactElement,
                  { size: 20 } as Record<string, unknown>,
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  {type.charAt(0) + type.slice(1).toLowerCase()}
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
