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
    if (!visualization.config || visualization.chartType !== "ternary") {
      throw new Error("Invalid chart type for ternary renderer");
    }

    // Get role-based data sources (ternary uses x, y, z for the three axes)
    const xDataSources = visualization.dataConfig.dataSources.filter((ds) => ds.role === "x");
    const yDataSources = visualization.dataConfig.dataSources.filter((ds) => ds.role === "y");
    const zDataSources = visualization.dataConfig.dataSources.filter((ds) => ds.role === "z");

    // Validate required axes
    if (!xDataSources.length || !xDataSources[0]?.columnName) {
      throw new Error("A-axis column not configured");
    }
    if (!yDataSources.length || !yDataSources[0]?.columnName) {
      throw new Error("B-axis column not configured");
    }
    if (!zDataSources.length || !zDataSources[0]?.columnName) {
      throw new Error("C-axis column not configured");
    }

    const aColumnName = xDataSources[0].columnName;
    const bColumnName = yDataSources[0].columnName;
    const cColumnName = zDataSources[0].columnName;

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
        name: "Data Points",
        mode: "markers" as const,
        marker: {
          size: 8,
          color: "#3b82f6",
          symbol: "circle" as const,
        },
      },
    ];

    // No boundaries for simplified role-based approach
    const boundaries = undefined;

    return (
      <div style={{ height: `${height}px`, width: "100%" }}>
        <TernaryPlot
          data={ternaryData}
          boundaries={boundaries}
          sum={100}
          aaxis={{
            title: xDataSources[0].alias ?? aColumnName,
            showgrid: true,
            showline: true,
            showticklabels: true,
            gridcolor: "#E6E6E6",
            linecolor: "#444",
          }}
          baxis={{
            title: yDataSources[0].alias ?? bColumnName,
            showgrid: true,
            showline: true,
            showticklabels: true,
            gridcolor: "#E6E6E6",
            linecolor: "#444",
          }}
          caxis={{
            title: zDataSources[0].alias ?? cColumnName,
            showgrid: true,
            showline: true,
            showticklabels: true,
            gridcolor: "#E6E6E6",
            linecolor: "#444",
          }}
          bgcolor="white"
          config={{
            title: visualization.name,
            showLegend: true,
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
