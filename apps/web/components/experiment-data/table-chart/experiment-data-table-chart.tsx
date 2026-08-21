"use client";

import { Pin, X } from "lucide-react";
import React from "react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import type { LineSeriesData } from "@repo/ui/components/charts/line-chart";
import { LineChart } from "@repo/ui/components/charts/line-chart";
import { readThemeColor } from "@repo/ui/components/charts/utils";

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
      // Plotly takes a concrete colour, so the contract token is resolved
      // rather than passed as `var()`.
      line: {
        color: readThemeColor("--chart-1"),
        width: 2,
      },
      showlegend: true,
    },
  ];

  return (
    <Card className="w-full gap-0 p-4">
      {isClicked && onClose && (
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pin className="text-status-active-foreground h-4 w-4" />
            <h4 className="text-sm font-medium">{columnName}</h4>
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground font-normal"
            type="button"
          >
            <X className="h-4 w-4" />
            {t("common.close")}
          </Button>
        </div>
      )}
      <div className="h-[460px] w-full">
        <LineChart
          data={seriesData}
          config={{
            title: `${columnName || "Chart"} Data Series`,
            xAxisTitle: "Pulses",
            yAxisTitle: "Intensity",
            useWebGL: false,
          }}
        />
      </div>
    </Card>
  );
}
