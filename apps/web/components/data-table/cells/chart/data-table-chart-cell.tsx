"use client";

import React, { useMemo } from "react";
import type { OnToggleCellExpansionHandler } from "~/components/data-table/data-table-columns";
import { sparklinePath } from "~/lib/sparkline-path";

import { parseNumericArray } from "./parse-numeric-array";

const SPARKLINE_BOX = { width: 80, height: 24, padding: 2 };

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

  const svgPath = useMemo(
    () => (parsedData.length === 0 ? "" : sparklinePath(parsedData, SPARKLINE_BOX)),
    [parsedData],
  );

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
