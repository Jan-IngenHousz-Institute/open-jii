"use client";

import React, { useMemo } from "react";

interface ExperimentDataTableChartCellProps {
  data: number[] | string;
  columnName: string;
  onHover?: (data: number[], columnName: string) => void;
  onLeave?: () => void;
  onClick?: (data: number[], columnName: string) => void;
}

export function ExperimentDataTableChartCell({
  data,
  columnName,
  onHover,
  onLeave,
  onClick,
}: ExperimentDataTableChartCellProps) {
  // Parse the array data - it comes as a string like "[1.2,3.4,5.6]" or JSON array
  const parseArrayData = (arrayString: string): number[] => {
    try {
      // First try to parse as JSON
      const jsonParsed: unknown = JSON.parse(arrayString);
      if (Array.isArray(jsonParsed)) {
        return jsonParsed.map((num) => parseFloat(String(num))).filter((num) => !isNaN(num));
      }
    } catch {
      // Fallback to manual parsing
      try {
        // Remove brackets and split by comma, then parse as numbers
        const cleanString = arrayString.replace(/^\[|\]$/g, "");
        if (!cleanString.trim()) return [];
        return cleanString
          .split(",")
          .map((str) => parseFloat(str.trim()))
          .filter((num) => !isNaN(num));
      } catch (error) {
        console.warn("Failed to parse array data:", { arrayString, error });
        return [];
      }
    }
    return [];
  };

  const parsedData = useMemo(() => {
    const result = Array.isArray(data) ? data : parseArrayData(String(data));
    return result;
  }, [data]);

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

  const handleHover = () => {
    if (parsedData.length > 0) {
      onHover?.(parsedData, columnName);
    }
  };

  const handleLeave = () => {
    onLeave?.();
  };

  const handleClick = () => {
    if (parsedData.length > 0) {
      onClick?.(parsedData, columnName);
    }
  };

  if (parsedData.length === 0) {
    return <div className="text-muted-foreground text-xs">No data</div>;
  }

  return (
    <div
      className="hover:bg-muted/50 relative flex h-8 w-20 cursor-pointer items-center justify-center rounded p-1"
      onMouseEnter={handleHover}
      onMouseLeave={handleLeave}
      onClick={handleClick}
    >
      <svg width="80" height="24" viewBox="0 0 80 24" className="overflow-visible">
        <path
          d={svgPath}
          fill="none"
          stroke="#0a4d4d"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
