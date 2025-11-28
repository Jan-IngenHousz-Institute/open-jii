"use client";

import { Pin, X } from "lucide-react";
import React from "react";

import { useTranslation } from "@repo/i18n";
import type { LineSeriesData } from "@repo/ui/components";
import { LineChart } from "@repo/ui/components";

interface ExperimentDataTableChartProps {
  data: number[];
  columnName: string;
  visible: boolean;
  isClicked?: boolean;
  onClose?: () => void;
}

export function ExperimentDataTableChart({
  data,
  columnName,
  visible,
  isClicked,
  onClose,
}: ExperimentDataTableChartProps) {
  const { t } = useTranslation("common");

  // Early return if not visible
  if (!visible) return null;

  // Validate data
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  // Create x-axis as indices
  const xValues = data.map((_, index) => index);

  const seriesData: LineSeriesData[] = [
    {
      name: columnName || "Chart",
      x: xValues,
      y: data,
      mode: "lines",
      line: {
        color: "#0a4d4d",
        width: 2,
      },
      showlegend: true,
    },
  ];

  return (
    <div className="bg-background w-full rounded-lg border p-4 shadow-lg">
      {isClicked && onClose && (
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pin className="h-4 w-4 text-teal-600" />
            <h4 className="text-sm font-medium">{columnName}</h4>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 rounded px-2 py-1 text-sm transition-colors hover:bg-gray-100"
            type="button"
          >
            <X className="h-4 w-4" />
            {t("common.close")}
          </button>
        </div>
      )}
      <div className="h-[460px] w-full">
        <LineChart
          data={seriesData}
          config={{
            title: `${columnName || "Chart"} Data Series`,
            xAxisTitle: "Pulses",
            yAxis: [{ title: "Intensity", type: "linear" }],
            useWebGL: false,
          }}
        />
      </div>
    </div>
  );
}
