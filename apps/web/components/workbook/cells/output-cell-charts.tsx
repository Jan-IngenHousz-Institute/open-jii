"use client";

import { X } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
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
  const { t } = useTranslation("workbook");
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
    <Button
      type="button"
      variant="ghost"
      className={`h-auto justify-start gap-2 p-1 text-left ${interactive ? "hover:bg-muted" : "cursor-default"}`}
      onClick={() => onClick?.(data, columnName)}
      aria-label={interactive ? t("output.expandChart", { column: columnName }) : undefined}
      data-testid={interactive ? `sparkline-${columnName}` : undefined}
      disabled={!interactive}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
        <path
          d={path}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-muted-foreground text-[10px] tabular-nums">n={data.length}</span>
    </Button>
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
  const { t } = useTranslation("workbook");
  const plotData: LineSeriesData[] = [
    {
      name: columnName,
      x: data.map((_, idx) => idx),
      y: data,
      mode: "lines",
      line: { color: "var(--primary)", width: 2 },
      showlegend: false,
    },
  ];
  return (
    <Card className="mt-3 gap-0 overflow-hidden py-0">
      <div className="border-border bg-muted flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-foreground text-xs font-semibold">{columnName}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground hover:bg-muted size-5"
          onClick={onClose}
          title={t("output.closeChart")}
          aria-label={t("output.closeChart")}
        >
          <X className="size-3" />
        </Button>
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
    </Card>
  );
}
