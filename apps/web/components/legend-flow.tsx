import type { Edge } from "@xyflow/react";
import React from "react";

export interface LegendFlowProps {
  nodeTypeColorMap: Record<string, { border: string; bg: string; icon: React.ReactNode }>;
  selectedEdgeId: string | null;
  edges: Edge[];
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
}

export function LegendFlow({ nodeTypeColorMap, selectedEdgeId, edges, setEdges }: LegendFlowProps) {
  // find the currently selected edge
  const edge = selectedEdgeId ? edges.find((e) => e.id === selectedEdgeId) : undefined;

  const getEditableLabelString = (): string => {
    if (!edge || edge.label == null) return "";
    if (typeof edge.label === "string") return edge.label;
    if (typeof edge.label === "number") return edge.label.toString();
    return "";
  };

  const labelStr = getEditableLabelString();

  return (
    <>
      {["input", "instruction", "question", "measurement", "analysis"].map((type) => {
        const colorClass = `${nodeTypeColorMap[type].border} ${nodeTypeColorMap[type].bg}`;
        return (
          <div
            key={type}
            draggable
            onDragStart={(e) => e.dataTransfer.setData("application/reactflow", type)}
            role="button"
            tabIndex={0}
            className={`flex items-center gap-2 rounded-lg border ${colorClass} cursor-grab px-2 py-2 shadow-md transition-transform hover:scale-105`}
          >
            {/* Icon */}
            <div className="text-slate-600">
              {React.cloneElement(
                nodeTypeColorMap[type].icon as React.ReactElement,
                { size: 20 } as Record<string, unknown>,
              )}
            </div>
            {/* Label */}
            <span className="text-sm font-medium">
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </span>
          </div>
        );
      })}

      {/* only show when an edge is selected */}
      {edge && (
        <div className="mt-4 space-y-4 rounded-lg bg-gray-50 p-3">
          {/* Animate toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-800">Animate this edge</span>
            <label className="relative inline-flex cursor-pointer">
              <input
                type="checkbox"
                checked={!!edge.animated}
                onChange={() => {
                  setEdges((eds) =>
                    eds.map((e) => (e.id === edge.id ? { ...e, animated: !e.animated } : e)),
                  );
                }}
                className="peer sr-only"
              />
              {/* track */}
              <div className="peer-checked:bg-jii-dark-green h-5 w-10 rounded-full bg-gray-200 transition-colors" />
              {/* thumb */}
              <div className="absolute left-0.5 top-0.5 h-4 w-4 transform rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
            </label>
          </div>

          {/* Label input - only show for string/number labels */}
          <div className="flex flex-col">
            <label className="mb-1 text-sm font-medium text-slate-800" htmlFor="edgeLabel">
              Edge Label
            </label>
            <input
              id="edgeLabel"
              type="text"
              value={labelStr}
              onChange={(e) => {
                const newLabel = e.target.value;
                setEdges((eds) =>
                  eds.map((ed) => (ed.id === edge.id ? { ...ed, label: newLabel } : ed)),
                );
              }}
              placeholder="Type here..."
              className="focus:ring-jii-dark-green w-full rounded-md border px-3 py-2 text-sm focus:ring-2"
            />
          </div>
          {/* Remove edge button */}
          <div className="flex justify-center">
            <button
              type="button"
              className="rounded bg-red-500 px-3 py-1 text-sm font-semibold text-white hover:bg-red-600"
              onClick={() => {
                setEdges((eds) => eds.filter((e) => e.id !== edge.id));
              }}
            >
              Remove Edge
            </button>
          </div>
        </div>
      )}
    </>
  );
}
