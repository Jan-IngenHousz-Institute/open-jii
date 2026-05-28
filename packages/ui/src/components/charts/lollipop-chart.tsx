"use client";

import React from "react";

import { DotPlot, type DotSeriesData } from "./dot-plot";
import type { BaseChartProps } from "./types";

export interface LollipopChartProps extends BaseChartProps {
  categories: string[];
  values: number[];
  name?: string;
  color?: string;
  orientation?: "v" | "h";
  stemWidth?: number;
  dotSize?: number;
  /**
   * Optional error magnitudes per category, aligned to `values`. When
   * present the dot trace gets `error_y` (or `error_x` in horizontal mode);
   * stem traces stay clean.
   */
  errors?: number[];
  errorBarThickness?: number;
  errorBarCapWidth?: number;
}

export function LollipopChart({
  categories,
  values,
  name,
  color = "#636EFA",
  orientation = "v",
  stemWidth = 2,
  dotSize = 12,
  errors,
  errorBarThickness = 1.5,
  errorBarCapWidth = 4,
  ...props
}: LollipopChartProps) {
  const isHorizontal = orientation === "h";

  // Always pass categories on `x` and values on `y`; `DotPlot` performs
  // the orientation swap itself.
  const stemData: DotSeriesData[] = categories.map((category, i) => ({
    x: [category, category] as (string | number | Date)[],
    y: [0, values[i]] as (string | number)[],
    name: `Stem ${i}`,
    color,
    orientation,
    line: { width: stemWidth },
    marker: { size: 0 },
    showlegend: false,
  }));

  // In horizontal mode the value axis is X, so error bars go on `error_x`.
  const errorBlock = errors
    ? ({
        type: "data" as const,
        array: errors,
        visible: true,
        thickness: errorBarThickness,
        width: errorBarCapWidth,
        color,
      } as DotSeriesData["error_y"])
    : undefined;

  const dotData: DotSeriesData = {
    x: categories,
    y: values,
    name: name || "Values",
    color,
    orientation,
    marker: { size: dotSize, symbol: "circle" },
    ...(errorBlock && (isHorizontal ? { error_x: errorBlock } : { error_y: errorBlock })),
  };

  return (
    <DotPlot
      data={[...stemData, dotData]}
      orientation={orientation}
      config={{
        ...props.config,
        // Title fallbacks reflect the physical axes after `DotPlot`'s swap.
        xAxisTitle: isHorizontal
          ? props.config?.xAxisTitle || "Value"
          : props.config?.xAxisTitle || "Category",
        yAxisTitle: isHorizontal
          ? props.config?.yAxisTitle || "Category"
          : props.config?.yAxisTitle || "Value",
      }}
      {...props}
    />
  );
}
