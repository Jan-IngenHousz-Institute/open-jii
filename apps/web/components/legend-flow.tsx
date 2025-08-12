import React, { useRef, useState } from "react";

import { Card, CardHeader, CardTitle, CardContent } from "@repo/ui/components";

import type { NodeType } from "./react-flow/node-config";
import { nodeTypeColorMap } from "./react-flow/node-config";

export function LegendFlow({
  cardClassName,
  dragHandle,
  overlay,
  containerRef,
  initialCorner,
}: {
  cardClassName?: string;
  dragHandle?: boolean;
  // When overlay is true, the legend renders absolutely positioned and is draggable within containerRef
  overlay?: boolean;
  containerRef?: React.RefObject<HTMLElement | null>;
  initialCorner?: "top-left" | "bottom-left" | "bottom-right";
}) {
  const nodeTypes = Object.keys(nodeTypeColorMap) as NodeType[];

  // Drag state only used in overlay mode
  type LegendCorner = "top-left" | "bottom-left" | "bottom-right";
  const [legendCorner, setLegendCorner] = useState<LegendCorner>(initialCorner ?? "bottom-right");
  const [isDragging, setIsDragging] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const legendRef = useRef<HTMLDivElement | null>(null);

  const getNearestCorner = (x: number, y: number): LegendCorner => {
    const container = containerRef?.current as HTMLElement | null;
    if (!container) return "bottom-right";
    const rect = container.getBoundingClientRect();
    // Distances to allowed corners (exclude top-right to avoid overlapping flow controls)
    const corners: { key: LegendCorner; cx: number; cy: number }[] = [
      { key: "top-left", cx: 16, cy: 16 },
      { key: "bottom-left", cx: 16, cy: rect.height - 16 },
      { key: "bottom-right", cx: rect.width - 16, cy: rect.height - 16 },
    ];
    let best: LegendCorner = "bottom-right";
    let bestD = Number.POSITIVE_INFINITY;
    for (const c of corners) {
      const dx = x - c.cx;
      const dy = y - c.cy;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = c.key;
      }
    }
    return best;
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (!overlay) return;
    // drag only on md+
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      return;
    }
    const container = containerRef?.current as HTMLElement | null;
    const legend = legendRef.current;
    if (!container || !legend) return;

    // Only start dragging if originating from the header drag handle
    const target = e.target as HTMLElement;
    const handle = target.closest('[data-legend-drag-handle="true"]');
    if (!handle) return;

    e.preventDefault();
    e.stopPropagation();

    const containerRect = container.getBoundingClientRect();
    const legendRect = legend.getBoundingClientRect();

    // Compute offset between pointer and legend top-left
    dragOffsetRef.current = {
      x: e.clientX - legendRect.left,
      y: e.clientY - legendRect.top,
    };

    // Initialize drag position to current legend position to avoid a flash before first mousemove
    const initialX = legendRect.left - containerRect.left;
    const initialY = legendRect.top - containerRect.top;
    setDragPos({ x: initialX, y: initialY });

    setIsDragging(true);

    const onMove = (ev: MouseEvent) => {
      const x = ev.clientX - containerRect.left - dragOffsetRef.current.x;
      const y = ev.clientY - containerRect.top - dragOffsetRef.current.y;
      // Clamp within container
      const maxX = containerRect.width - legendRect.width;
      const maxY = containerRect.height - legendRect.height;
      const clampedX = Math.max(0, Math.min(x, maxX));
      const clampedY = Math.max(0, Math.min(y, maxY));
      setDragPos({ x: clampedX, y: clampedY });
    };

    const onUp = (ev: MouseEvent) => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);

      const dropX = ev.clientX - containerRect.left;
      const dropY = ev.clientY - containerRect.top;
      const corner = getNearestCorner(dropX, dropY);
      setLegendCorner(corner);
      setIsDragging(false);
      setDragPos(null);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const cornerClass = isDragging
    ? ""
    : legendCorner === "top-left"
      ? "top-4 left-4"
      : legendCorner === "bottom-left"
        ? "bottom-4 left-4"
        : "bottom-4 right-4";

  const card = (
    <Card className={`w-full max-w-full md:w-48 ${cardClassName ?? ""}`}>
      <CardHeader
        data-legend-drag-handle={dragHandle ? "true" : undefined}
        className={dragHandle ? "cursor-grab select-none active:cursor-grabbing" : undefined}
      >
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

  if (overlay) {
    return (
      <div
        ref={legendRef}
        onMouseDown={onMouseDown}
        className={`pointer-events-auto absolute z-10 hidden md:block ${cornerClass}`}
        style={
          isDragging && dragPos
            ? { left: dragPos.x, top: dragPos.y, willChange: "left, top" }
            : undefined
        }
      >
        {card}
      </div>
    );
  }

  return card;
}
