"use client";

import React from "react";

import type { ExperimentVisualization } from "@repo/api";
import { CorrelationMatrix } from "@repo/ui/components";

export interface CorrelationMatrixChartRendererProps {
  visualization: ExperimentVisualization;
  experimentId: string;
  data?: Record<string, unknown>[];
  height?: number;
  isPreview?: boolean;
}

export function CorrelationMatrixChartRenderer({
  visualization,
  data,
  height = 400,
}: CorrelationMatrixChartRendererProps) {
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
    // Ensure this is a correlation matrix chart
    if (!visualization.config || visualization.chartType !== "correlation-matrix") {
      throw new Error("Invalid chart type for correlation matrix chart renderer");
    }

    // Get all data sources (correlation matrix uses all variables)
    const dataSources = visualization.dataConfig.dataSources;

    // Validate that we have at least 2 variables
    if (dataSources.length < 2) {
      throw new Error("At least 2 variables are required for correlation matrix");
    }

    // Extract numeric values for each variable
    const variables = dataSources.map((dataSource) => ({
      name: dataSource.alias ?? dataSource.columnName,
      columnName: dataSource.columnName,
      values: [] as number[],
    }));

    // Extract numeric values from data and filter out non-numeric values
    const validRows = data.filter((row) => {
      return variables.every((variable) => {
        const value = row[variable.columnName];
        const numericValue = Number(value);
        return value != null && !isNaN(numericValue);
      });
    });

    // Second pass: extract numeric values from valid rows
    validRows.forEach((row) => {
      variables.forEach((variable) => {
        const value = row[variable.columnName];
        variable.values.push(Number(value));
      });
    });

    if (validRows.length === 0) {
      throw new Error("No valid numeric data found for correlation analysis");
    }

    if (validRows.length < 2) {
      throw new Error("At least 2 data points are required for correlation analysis");
    }

    // Calculate correlation matrix
    const correlationMatrix = calculateCorrelationMatrix(variables.map((v) => v.values));
    const labels = variables.map((v) => v.name);

    // Prepare configuration for CorrelationMatrix component
    const correlationConfig = {
      title: visualization.name || "Correlation Matrix",
      useWebGL: false,
    };

    return (
      <div style={{ height }}>
        <CorrelationMatrix
          correlationMatrix={correlationMatrix}
          labels={labels}
          name={visualization.name}
          showValues={true}
          colorscale="RdBu"
          config={correlationConfig}
        />
      </div>
    );
  } catch (error) {
    console.error("Error rendering correlation matrix chart:", error);
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground text-center">
          <div className="mb-2 text-lg font-medium">Error Loading Chart</div>
          <div className="text-sm">
            {error instanceof Error ? error.message : "Unknown error occurred"}
          </div>
        </div>
      </div>
    );
  }
}

/**
 * Calculate Pearson correlation matrix for the given variables
 * @param variables Array of numeric arrays, each representing values for a variable
 * @returns 2D array representing the correlation matrix
 */
function calculateCorrelationMatrix(variables: number[][]): number[][] {
  const numVariables = variables.length;
  const correlationMatrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i < numVariables; i++) {
    correlationMatrix[i] = new Array<number>(numVariables);
  }

  // Calculate correlations
  for (let i = 0; i < numVariables; i++) {
    for (let j = 0; j < numVariables; j++) {
      if (i === j) {
        // Correlation of a variable with itself is always 1
        correlationMatrix[i][j] = 1.0;
      } else {
        // Calculate Pearson correlation coefficient
        correlationMatrix[i][j] = calculatePearsonCorrelation(variables[i], variables[j]);
      }
    }
  }

  return correlationMatrix;
}

/**
 * Calculate Pearson correlation coefficient between two variables
 * @param x First variable values
 * @param y Second variable values
 * @returns Pearson correlation coefficient (-1 to 1)
 */
function calculatePearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);

  if (n === 0) return 0;
  if (n === 1) return 0; // Cannot calculate correlation with only one data point

  // Calculate means
  const meanX = x.slice(0, n).reduce((sum, val) => sum + val, 0) / n;
  const meanY = y.slice(0, n).reduce((sum, val) => sum + val, 0) / n;

  // Calculate numerator and denominators
  let numerator = 0;
  let sumSquareX = 0;
  let sumSquareY = 0;

  for (let i = 0; i < n; i++) {
    const diffX = x[i] - meanX;
    const diffY = y[i] - meanY;

    numerator += diffX * diffY;
    sumSquareX += diffX * diffX;
    sumSquareY += diffY * diffY;
  }

  // Calculate correlation coefficient
  const denominator = Math.sqrt(sumSquareX * sumSquareY);

  if (denominator === 0) {
    return 0; // No correlation if either variable has no variance
  }

  const correlation = numerator / denominator;

  // Clamp to [-1, 1] to handle floating point precision issues
  return Math.max(-1, Math.min(1, correlation));
}
