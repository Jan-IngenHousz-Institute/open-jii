"use client";

import { X } from "lucide-react";

import type { LineSeriesData } from "@repo/ui/components/charts/line-chart";
import { LineChart } from "@repo/ui/components/charts/line-chart";

export type ChartClickHandler = (data: number[], columnName: string) => void;

export function Sparkline({
  data,
  columnName,
  onClick,
}: {
  data: number[];
  columnName: string;
  onClick?: ChartClickHandler;
}) {
  const width = 80;
  const height = 24;
  const padding = 2;
  const minY = Math.min(...data);
  const maxY = Math.max(...data);
  const rangeY = maxY - minY || 1;
  const points = data
    .map((value, index) => {
      const x = padding + (index / (data.length - 1 || 1)) * (width - 2 * padding);
      const y = height - padding - ((value - minY) / rangeY) * (height - 2 * padding);
      return `${x},${y}`;
    })
    .join(" L ");
  const path = `M ${points}`;
  const interactive = !!onClick;
  return (
    <button
      type="button"
      className={`flex items-center gap-2 rounded p-1 text-left transition-colors ${interactive ? "hover:bg-[#EDF2F6]" : "cursor-default"}`}
      onClick={() => onClick?.(data, columnName)}
      aria-label={interactive ? `Expand chart for ${columnName}` : undefined}
      disabled={!interactive}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
        <path
          d={path}
          fill="none"
          stroke="#005E5E"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-[10px] tabular-nums text-[#68737B]">n={data.length}</span>
    </button>
  );
}

export function ExpandedChart({
  data,
  columnName,
  onClose,
}: {
  data: number[];
  columnName: string;
  onClose: () => void;
}) {
  const plotData: LineSeriesData[] = [
    {
      name: columnName,
      x: data.map((_, idx) => idx),
      y: data,
      mode: "lines",
      line: { color: "#005E5E", width: 2 },
      showlegend: false,
    },
  ];
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-[#EDF2F6] bg-white">
      <div className="flex items-center justify-between border-b border-[#EDF2F6] bg-[#F7F8FA] px-3 py-1.5">
        <span className="text-xs font-semibold text-[#011111]">{columnName}</span>
        <button
          type="button"
          className="flex size-5 items-center justify-center rounded text-[#68737B] hover:bg-[#EDF2F6]"
          onClick={onClose}
          title="Close chart"
          aria-label="Close chart"
        >
          <X className="size-3" />
        </button>
      </div>
      {/* Plotly renders at ~450px when its container's height isn't propagated through the
          plotly-container div (a quirk of the shared chart wrapper). Match the experiment-data
          chart's 460px so the X-axis ticks and "Index" title aren't clipped. */}
      <div className="h-[460px] w-full px-2 pb-2 pt-1">
        <LineChart
          data={plotData}
          config={{ xAxisTitle: "Index", yAxisTitle: columnName, useWebGL: false }}
        />
      </div>
    </div>
  );
}
