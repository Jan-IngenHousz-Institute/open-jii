"use client";

import type { EdgeProps } from "@xyflow/react";
import { BaseEdge, EdgeLabelRenderer } from "@xyflow/react";
import React from "react";

export function BackEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
  label,
  labelStyle,
  labelBgStyle,
  labelBgPadding,
  labelBgBorderRadius,
}: EdgeProps) {
  const dx = sourceX - targetX;
  const archHeight = Math.min(80, Math.max(40, dx * 0.06));
  const apexY = Math.max(sourceY, targetY) + archHeight;
  const offset = 28;

  const path = [
    `M ${sourceX},${sourceY}`,
    `C ${sourceX + offset},${sourceY} ${sourceX + offset},${apexY} ${sourceX},${apexY}`,
    `L ${targetX},${apexY}`,
    `C ${targetX - offset},${apexY} ${targetX - offset},${targetY} ${targetX},${targetY}`,
  ].join(" ");

  const labelX = (sourceX + targetX) / 2;
  const labelY = apexY;

  const padX = Array.isArray(labelBgPadding) ? labelBgPadding[0] : 8;
  const padY = Array.isArray(labelBgPadding) ? labelBgPadding[1] : 4;
  const stroke = labelBgStyle?.stroke;
  const fill = labelBgStyle?.fill ?? "#FFFFFF";

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      {label != null && label !== "" && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              background: fill,
              border: stroke ? `1px solid ${stroke}` : undefined,
              padding: `${padY}px ${padX}px`,
              borderRadius: labelBgBorderRadius ?? 6,
              fontSize: 11,
              fontWeight: 500,
              color: labelStyle?.fill ?? "#475569",
              pointerEvents: "all",
              whiteSpace: "nowrap",
            }}
            className="nodrag nopan"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
