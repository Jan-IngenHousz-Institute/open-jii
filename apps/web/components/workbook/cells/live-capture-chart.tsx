"use client";

import type { LiveCapturePoint } from "@/hooks/workbook/useLiveCapture/useLiveCapture";

import { useTranslation } from "@repo/i18n";
import type { LineSeriesData } from "@repo/ui/components/charts/line-chart";
import { LineChart } from "@repo/ui/components/charts/line-chart";

interface LiveCaptureChartProps {
  points: LiveCapturePoint[];
  /** Series/axis label, e.g. the command being sampled ("par"). */
  label: string;
}

/**
 * Live line graph for a command cell's capture loop. Plain SVG scatter
 * (useWebGL: false) so an always-mounted, re-rendering-every-second chart
 * never holds one of the page's capped WebGL contexts.
 */
export function LiveCaptureChart({ points, label }: LiveCaptureChartProps) {
  const { t } = useTranslation("workbook");
  const series: LineSeriesData[] = [
    {
      name: label,
      x: points.map((p) => p.t),
      y: points.map((p) => p.value),
      mode: "lines",
      line: { color: "#119DA4", width: 2 },
      showlegend: false,
    },
  ];
  return (
    <div className="overflow-hidden rounded-lg border border-[#EDF2F6] bg-white">
      {/* Fixed height for the same shared-wrapper reason as ExpandedChart;
          260px keeps the live view compact inside the cell. */}
      <div className="h-[260px] w-full px-2 pb-2 pt-1">
        <LineChart
          data={series}
          config={{ xAxisTitle: t("cells.liveXAxis"), yAxisTitle: label, useWebGL: false }}
        />
      </div>
    </div>
  );
}
