"use client";

import React, { useMemo } from "react";
import type { OnToggleCellExpansionHandler } from "~/components/data-table/data-table-columns";

import { parseNumericArray } from "./parse-numeric-array";

interface DataTableChartCellProps {
  data: number[] | string;
  columnName: string;
  rowId: string;
  onToggleExpansion?: OnToggleCellExpansionHandler;
}

export function DataTableChartCell({
  data,
  columnName,
  rowId,
  onToggleExpansion,
}: DataTableChartCellProps) {
  const parsedData = useMemo(() => parseNumericArray(data), [data]);

  // Create SVG path for the line chart
  const svgPath = useMemo(() => {
    if (parsedData.length === 0) return "";

    const width = 80;
    const height = 24;
    const padding = 2;
    const minY = Math.min(...parsedData);
    const maxY = Math.max(...parsedData);
    const rangeY = maxY - minY || 1; // Avoid division by zero

    const points = parsedData.map((value, index) => {
      const x = padding + (index / (parsedData.length - 1 || 1)) * (width - 2 * padding);
      const y = height - padding - ((value - minY) / rangeY) * (height - 2 * padding);
      return `${x},${y}`;
    });

    return `M ${points.join(" L ")}`;
  }, [parsedData]);

  const handleClick = () => {
    if (parsedData.length > 0) {
      onToggleExpansion?.(rowId, columnName);
    }
  };

  if (parsedData.length === 0) {
    return <div className="text-muted-foreground text-xs">No data</div>;
  }

  return (
    <div
      className="hover:bg-muted/30 relative flex h-8 w-20 cursor-pointer items-center justify-center rounded p-1 transition-colors"
      onClick={handleClick}
    >
      <svg width="80" height="24" viewBox="0 0 80 24" className="overflow-visible">
        <path
          d={svgPath}
          fill="none"
          className="stroke-chart-1"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
