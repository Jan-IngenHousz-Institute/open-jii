"use client";

import { LineChart } from "@/components/charts/line-chart";
import { sparklinePath } from "@/lib/sparkline-path";
import { X } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import type { LineSeriesData } from "@repo/ui/components/charts/line-chart";
import { useChartThemeRefresh } from "@repo/ui/components/charts/use-chart-theme-refresh";
import { readThemeColor } from "@repo/ui/components/charts/utils";

export type ChartClickHandler = (data: number[], columnName: string) => void;

const SPARKLINE_WIDTH = 80;
const SPARKLINE_HEIGHT = 24;
const SPARKLINE_PADDING = 2;
const SPARKLINE_BOX = {
  width: SPARKLINE_WIDTH,
  height: SPARKLINE_HEIGHT,
  padding: SPARKLINE_PADDING,
};

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
  const path = sparklinePath(data, SPARKLINE_BOX);
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
      <svg
        width={SPARKLINE_WIDTH}
        height={SPARKLINE_HEIGHT}
        viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
        className="shrink-0"
      >
        <path
          d={path}
          fill="none"
          className="stroke-primary"
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
  // Plotly parses colour itself and cannot read a CSS variable.
  useChartThemeRefresh();
  const lineColor = readThemeColor("--primary") ?? "#0f766e";
  const plotData: LineSeriesData[] = [
    {
      name: columnName,
      x: data.map((_, idx) => idx),
      y: data,
      mode: "lines",
      line: { color: lineColor, width: 2 },
      showlegend: false,
    },
  ];
  return (
    <Card padding="none" className="mt-3 overflow-hidden">
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
