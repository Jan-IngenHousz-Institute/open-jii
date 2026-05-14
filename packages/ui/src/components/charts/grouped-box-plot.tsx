"use client";

import React from "react";

import { BoxPlot, type BoxSeriesData } from "./box-plot";
import type { BaseChartProps } from "./types";

export interface GroupedBoxPlotProps extends BaseChartProps {
  groups: {
    name: string;
    values: number[];
    color?: string;
  }[];
  groupBy?: string[];
  orientation?: "v" | "h";
}

export function GroupedBoxPlot({
  groups,
  groupBy,
  orientation = "v",
  ...props
}: GroupedBoxPlotProps) {
  // For grouped box plots each group needs the same x categories repeated.
  const data: BoxSeriesData[] = groups.map((group) => {
    const xValues: string[] = [];
    const yValues: number[] = [];

    const groupByArr =
      groupBy && groupBy.length > 0 ? groupBy : group.values.map((_, i) => `Category ${i + 1}`);

    const valuesPerCategory = Math.ceil(group.values.length / groupByArr.length);

    for (let i = 0; i < groupByArr.length; i++) {
      const categoryValues = group.values.slice(i * valuesPerCategory, (i + 1) * valuesPerCategory);

      categoryValues.forEach((value) => {
        xValues.push(groupByArr[i] || `Category ${i + 1}`);
        yValues.push(value);
      });
    }

    if (orientation === "v") {
      return {
        y: yValues,
        x: xValues,
        name: group.name,
        color: group.color,
        orientation,
      };
    }
    return {
      x: yValues,
      y: xValues,
      name: group.name,
      color: group.color,
      orientation,
    };
  });

  return <BoxPlot data={data} orientation={orientation} boxmode="group" {...props} />;
}
