"use client";

import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import { TernaryPlot } from "@repo/ui/components";

export interface TernaryChartRendererProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  data?: Record<string, unknown>[];
  height?: number;
  isPreview?: boolean;
}

export function TernaryChartRenderer({
  visualization,
  data,
  height = 400,
  isPreview: _isPreview = false,
}: TernaryChartRendererProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground text-center">
          <div className="mb-2 text-lg font-medium">No Data Available</div>
          <div className="text-sm">Please ensure your experiment has data to visualize</div>
        </div>
      </div>
    );
  }

  try {
    // Ensure this is a ternary chart and get configuration with proper typing
    if (visualization.config.chartType !== "ternary") {
      throw new Error("Invalid chart type for ternary renderer");
    }

    const config = visualization.config.config;

    // Validate required axes
    if (!config.aAxis.dataSource.columnName) {
      throw new Error("A-axis column not configured");
    }
    if (!config.bAxis.dataSource.columnName) {
      throw new Error("B-axis column not configured");
    }
    if (!config.cAxis.dataSource.columnName) {
      throw new Error("C-axis column not configured");
    }

    const aColumnName = config.aAxis.dataSource.columnName;
    const bColumnName = config.bAxis.dataSource.columnName;
    const cColumnName = config.cAxis.dataSource.columnName;

    // Extract ternary data from the dataset
    const aValues: number[] = [];
    const bValues: number[] = [];
    const cValues: number[] = [];

    data.forEach((row) => {
      const aValue = row[aColumnName];
      const bValue = row[bColumnName];
      const cValue = row[cColumnName];

      // Convert to numbers, filtering out invalid values
      const numA = typeof aValue === "number" ? aValue : Number(aValue);
      const numB = typeof bValue === "number" ? bValue : Number(bValue);
      const numC = typeof cValue === "number" ? cValue : Number(cValue);

      if (!isNaN(numA) && !isNaN(numB) && !isNaN(numC)) {
        aValues.push(numA);
        bValues.push(numB);
        cValues.push(numC);
      }
    });

    if (aValues.length === 0) {
      throw new Error("No valid numeric data found for ternary plot");
    }

    // Prepare ternary plot data
    const ternaryData = [
      {
        a: aValues,
        b: bValues,
        c: cValues,
        name: config.aAxis.dataSource.alias ?? "Data Points",
        mode: config.mode,
        marker: {
          size: 8,
          color: "#3b82f6",
          symbol: "circle",
        },
      },
    ];

    // Add boundaries if configured
    const boundaries = config.boundaries?.map((boundary) => {
      // Extract boundary data from columns like we do for axes
      const aColumnName = boundary.a.dataSource.columnName;
      const bColumnName = boundary.b.dataSource.columnName;
      const cColumnName = boundary.c.dataSource.columnName;

      // Extract boundary values from the dataset
      const aBoundaryValues: number[] = [];
      const bBoundaryValues: number[] = [];
      const cBoundaryValues: number[] = [];

      data.forEach((row) => {
        const aValue = row[aColumnName];
        const bValue = row[bColumnName];
        const cValue = row[cColumnName];

        // Convert to numbers, filtering out invalid values
        const numA = typeof aValue === "number" ? aValue : Number(aValue);
        const numB = typeof bValue === "number" ? bValue : Number(bValue);
        const numC = typeof cValue === "number" ? cValue : Number(cValue);

        if (!isNaN(numA) && !isNaN(numB) && !isNaN(numC)) {
          aBoundaryValues.push(numA);
          bBoundaryValues.push(numB);
          cBoundaryValues.push(numC);
        }
      });

      return {
        name: boundary.name,
        a: aBoundaryValues,
        b: bBoundaryValues,
        c: cBoundaryValues,
        line: {
          color: boundary.line?.color ?? "#333",
          width: boundary.line?.width ?? 2,
          dash: boundary.line?.dash ?? "solid",
        },
        fillcolor: boundary.fillcolor,
        opacity: boundary.opacity,
      };
    });

    return (
      <div style={{ height: `${height}px`, width: "100%" }}>
        <TernaryPlot
          data={ternaryData}
          boundaries={boundaries}
          sum={config.sum || 100}
          aaxis={{
            title: config.aAxisProps?.title ?? config.aAxis.dataSource.alias ?? aColumnName,
            showgrid: config.aAxisProps?.showgrid !== false,
            showline: config.aAxisProps?.showline !== false,
            showticklabels: config.aAxisProps?.showticklabels !== false,
            gridcolor: config.aAxisProps?.gridcolor ?? "#E6E6E6",
            linecolor: config.aAxisProps?.linecolor ?? "#444",
          }}
          baxis={{
            title: config.bAxisProps?.title ?? config.bAxis.dataSource.alias ?? bColumnName,
            showgrid: config.bAxisProps?.showgrid !== false,
            showline: config.bAxisProps?.showline !== false,
            showticklabels: config.bAxisProps?.showticklabels !== false,
            gridcolor: config.bAxisProps?.gridcolor ?? "#E6E6E6",
            linecolor: config.bAxisProps?.linecolor ?? "#444",
          }}
          caxis={{
            title: config.cAxisProps?.title ?? config.cAxis.dataSource.alias ?? cColumnName,
            showgrid: config.cAxisProps?.showgrid !== false,
            showline: config.cAxisProps?.showline !== false,
            showticklabels: config.cAxisProps?.showticklabels !== false,
            gridcolor: config.cAxisProps?.gridcolor ?? "#E6E6E6",
            linecolor: config.cAxisProps?.linecolor ?? "#444",
          }}
          bgcolor={config.bgcolor}
          config={{
            title: config.display?.title ?? visualization.name,
            showLegend: config.display?.showLegend ?? true,
            responsive: true,
            backgroundColor: "white",
          }}
        />
      </div>
    );
  } catch (error) {
    return (
      <div className="bg-destructive/10 text-destructive flex h-full items-center justify-center rounded-lg border">
        <div className="text-center">
          <div className="mb-2 text-lg font-medium">Configuration Error</div>
          <div className="text-sm">
            {error instanceof Error ? error.message : "Invalid chart configuration"}
          </div>
        </div>
      </div>
    );
  }
}
