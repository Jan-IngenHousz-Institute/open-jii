"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import type { BaseChartProps, BaseSeries, SafeLayout } from "../../common";
import {
  PlotlyChart,
  createBaseLayout,
  createPlotlyConfig,
  getRenderer,
  getPlotType,
} from "../../common";

export interface DensityPlotProps extends BaseChartProps {
  x: number[];
  y: number[];
  name?: string;
  color?: string;

  // What to show
  showScatter?: boolean;
  showContours?: boolean;
  showMarginalHistograms?: boolean;

  // Scatter configuration
  scatterSize?: number;
  scatterOpacity?: number;
  scatterMode?: "markers" | "lines" | "markers+lines";

  // Contour configuration
  ncontours?: number;
  colorscale?: string;
  reversescale?: boolean;
  showscale?: boolean;
  nbinsx?: number;
  nbinsy?: number;

  // Marginal histogram configuration
  marginalColor?: string;
}

export function DensityPlot({
  x,
  y,
  name = "data",
  color = "rgb(102,0,0)",
  showScatter = false,
  showContours = true,
  showMarginalHistograms = false,
  scatterSize = 2,
  scatterOpacity = 0.4,
  scatterMode = "markers",
  ncontours = 20,
  colorscale = "Hot",
  reversescale = true,
  showscale = true,
  nbinsx = 20,
  nbinsy = 20,
  marginalColor,
  config = {},
  className,
  loading,
  error,
}: DensityPlotProps) {
  const plotData: PlotData[] = [];

  if (showMarginalHistograms) {
    // Use the working marginal histogram approach
    // Main scatter points
    if (showScatter) {
      plotData.push({
        x: x,
        y: y,
        mode: scatterMode,
        name: "points",
        marker: {
          color: color,
          size: scatterSize,
          opacity: scatterOpacity,
        },
        type: "scatter",
      } as any as PlotData);
    }

    // 2D density contour
    if (showContours) {
      plotData.push({
        x: x,
        y: y,
        name: "density",
        ncontours: ncontours,
        colorscale: colorscale,
        reversescale: reversescale,
        showscale: false,
        type: "histogram2dcontour",
      } as any as PlotData);
    }

    // X-axis marginal histogram
    plotData.push({
      x: x,
      name: "x density",
      marker: { color: marginalColor || color },
      yaxis: "y2",
      type: "histogram",
    } as any as PlotData);

    // Y-axis marginal histogram
    plotData.push({
      y: y,
      name: "y density",
      marker: { color: marginalColor || color },
      xaxis: "x2",
      type: "histogram",
    } as any as PlotData);
  } else {
    // Simple case without marginals
    if (showScatter) {
      plotData.push({
        x: x,
        y: y,
        mode: scatterMode,
        name: "points",
        marker: {
          color: color,
          size: scatterSize,
          opacity: scatterOpacity,
        },
        type: "scatter",
      } as any as PlotData);
    }

    if (showContours) {
      plotData.push({
        x: x,
        y: y,
        name: "density",
        ncontours: ncontours,
        colorscale: colorscale,
        reversescale: reversescale,
        showscale: showscale,
        nbinsx: nbinsx,
        nbinsy: nbinsy,
        type: "histogram2dcontour",
      } as any as PlotData);
    }
  }

  // Create layout based on whether marginal histograms are shown
  let layout;
  if (showMarginalHistograms) {
    // Layout with marginal subplots (like Plotly documentation)
    layout = {
      ...createBaseLayout(config),
      showlegend: false,
      autosize: true,
      margin: { t: 50, l: 60, r: 60, b: 60 },
      hovermode: "closest",
      bargap: 0,
      // Main plot axes
      xaxis: {
        domain: [0, 0.85],
        showgrid: false,
        zeroline: false,
        title: config.xAxisTitle ? { text: config.xAxisTitle } : undefined,
      },
      yaxis: {
        domain: [0, 0.85],
        showgrid: false,
        zeroline: false,
        title: config.yAxis?.[0]?.title ? { text: config.yAxis[0].title } : undefined,
      },
      // Marginal histogram axes
      xaxis2: {
        domain: [0.85, 1],
        showgrid: false,
        zeroline: false,
        showticklabels: true,
      },
      yaxis2: {
        domain: [0.85, 1],
        showgrid: false,
        zeroline: false,
        showticklabels: true,
      },
    } as any; // Layout type allows flexible property assignment
  } else {
    // Use similar layout structure but without marginal axes
    layout = {
      ...createBaseLayout(config),
      showlegend: false,
      autosize: true,
      margin: { t: 50, l: 60, r: 60, b: 60 },
      hovermode: "closest",
      bargap: 0,
      xaxis: {
        showgrid: false,
        zeroline: false,
        title: config.xAxisTitle ? { text: config.xAxisTitle } : undefined,
      },
      yaxis: {
        showgrid: false,
        zeroline: false,
        title: config.yAxis?.[0]?.title ? { text: config.yAxis[0].title } : undefined,
      },
    } as any; // Layout type allows flexible property assignment
  }

  const plotConfig = createPlotlyConfig(config);

  return (
    <div className={className}>
      <PlotlyChart
        data={plotData}
        layout={layout}
        config={plotConfig}
        loading={loading}
        error={error}
      />
    </div>
  );
}

// Ridge plot (multiple density plots stacked)
export interface RidgeSeriesData extends BaseSeries {
  x: number[]; // X values for the density curve
  y: number[]; // Y density values (already calculated)
  category: string;
  offset?: number;
}

export interface RidgePlotProps extends BaseChartProps {
  data: RidgeSeriesData[];
  spacing?: number;
  fill?: boolean;
  colorScale?: string; // For heatmap colors (e.g., "Viridis", "Plasma", "Blues", etc.)
  colorMode?: "solid" | "gradient"; // Solid color or gradient based on X values
}

export function RidgePlot({
  data,
  config = {},
  className,
  loading,
  error,
  spacing = 1,
  fill = true,
  colorScale = "Viridis",
  colorMode = "solid",
}: RidgePlotProps) {
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("scatter", renderer);

  // Helper function to generate heatmap colors
  const getHeatmapColor = (ratio: number, colorScale: string): string => {
    const t = Math.max(0, Math.min(1, ratio));

    switch (colorScale) {
      case "Blues":
        // Light blue to dark blue
        const r = Math.round(247 - t * 239);
        const g = Math.round(251 - t * 183);
        const b = Math.round(255 - t * 147);
        return `rgb(${r}, ${g}, ${b})`;

      case "Plasma":
        // Purple to yellow (authentic plasma colors)
        if (t < 0.33) {
          const r = Math.round(13 + t * 3 * 107);
          const g = Math.round(8 + t * 3 * 35);
          const b = Math.round(135 + t * 3 * 55);
          return `rgb(${r}, ${g}, ${b})`;
        } else if (t < 0.66) {
          const r = Math.round(120 + (t - 0.33) * 3 * 108);
          const g = Math.round(43 + (t - 0.33) * 3 * 74);
          const b = Math.round(190 - (t - 0.33) * 3 * 44);
          return `rgb(${r}, ${g}, ${b})`;
        } else {
          const r = Math.round(228 + (t - 0.66) * 3 * 22);
          const g = Math.round(117 + (t - 0.66) * 3 * 138);
          const b = Math.round(146 - (t - 0.66) * 3 * 126);
          return `rgb(${r}, ${g}, ${b})`;
        }

      case "Viridis":
      default:
        // Authentic Viridis: dark purple to yellow-green
        if (t < 0.25) {
          const r = Math.round(68 + t * 4 * 27);
          const g = Math.round(1 + t * 4 * 51);
          const b = Math.round(84 + t * 4 * 84);
          return `rgb(${r}, ${g}, ${b})`;
        } else if (t < 0.5) {
          const r = Math.round(95 + (t - 0.25) * 4 * 26);
          const g = Math.round(52 + (t - 0.25) * 4 * 80);
          const b = Math.round(168 + (t - 0.25) * 4 * 24);
          return `rgb(${r}, ${g}, ${b})`;
        } else if (t < 0.75) {
          const r = Math.round(121 + (t - 0.5) * 4 * 73);
          const g = Math.round(132 + (t - 0.5) * 4 * 63);
          const b = Math.round(192 - (t - 0.5) * 4 * 44);
          return `rgb(${r}, ${g}, ${b})`;
        } else {
          const r = Math.round(194 + (t - 0.75) * 4 * 59);
          const g = Math.round(195 + (t - 0.75) * 4 * 58);
          const b = Math.round(148 - (t - 0.75) * 4 * 83);
          return `rgb(${r}, ${g}, ${b})`;
        }
    }
  };

  // Calculate density curves for each series
  const plotData: PlotData[] = [];

  // Process data in reverse order so higher Y-axis items (top mountains) render last and appear in front
  [...data].reverse().forEach((series, reverseIndex) => {
    const index = data.length - 1 - reverseIndex; // Original index for positioning
    // Use the provided density data directly
    const xPoints = series.x;
    const densityPoints = series.y;

    // Normalize density and offset for stacking
    const maxDensity = Math.max(...densityPoints);
    const mountainHeight = 0.6; // Height of each mountain (independent of spacing)
    const normalizedDensity = densityPoints.map((d) => (d / maxDensity) * mountainHeight);
    const yOffset = index * spacing;

    // Use heatmap coloring based on X-axis values (temperature range)
    const xMin = Math.min(...xPoints);
    const xMax = Math.max(...xPoints);
    const xMean = (xMin + xMax) / 2; // Use mean temperature for this mountain

    // Find global X range across all mountains for proper scaling
    const allXValues = data.flatMap((s) => s.x);
    const globalXMin = Math.min(...allXValues);
    const globalXMax = Math.max(...allXValues);

    // Generate colors based on colorMode
    let fillColor: string | null;
    let lineColor: string;

    if (colorMode === "gradient") {
      // For Plotly gradient, we need to use marker.color with colorscale
      // We'll create a custom approach using multiple traces or segments
      fillColor = null; // Will handle gradient differently
      const xMean = (Math.min(...xPoints) + Math.max(...xPoints)) / 2;
      const xRatio = (xMean - globalXMin) / (globalXMax - globalXMin);
      lineColor = getHeatmapColor(xRatio, colorScale);
    } else {
      // Solid color based on mean X position (original behavior)
      const xMean = (Math.min(...xPoints) + Math.max(...xPoints)) / 2;
      const xRatio = (xMean - globalXMin) / (globalXMax - globalXMin);
      const heatmapColor = getHeatmapColor(xRatio, colorScale);
      fillColor = `${heatmapColor}80`; // Add transparency for solid
      lineColor = heatmapColor;
    }

    if (fill) {
      if (colorMode === "gradient") {
        // Create gradient effect by dividing the mountain into segments
        const numSegments = Math.min(20, xPoints.length - 1);

        for (let seg = 0; seg < numSegments; seg++) {
          const startIdx = Math.floor((seg / numSegments) * (xPoints.length - 1));
          const endIdx = Math.floor(((seg + 1) / numSegments) * (xPoints.length - 1));

          if (startIdx < endIdx) {
            const segXPoints = xPoints.slice(startIdx, endIdx + 1);
            const segDensity = normalizedDensity.slice(startIdx, endIdx + 1);

            // Calculate color for this segment based on X position
            const firstX = segXPoints[0];
            const lastX = segXPoints[segXPoints.length - 1];
            if (firstX !== undefined && lastX !== undefined) {
              const segMeanX = (firstX + lastX) / 2;
              const segRatio = (segMeanX - globalXMin) / (globalXMax - globalXMin);
              const segColor = getHeatmapColor(segRatio, colorScale);

              // Create closed polygon for this segment
              const xClosed = [firstX, ...segXPoints, lastX];
              const yClosed = [yOffset, ...segDensity.map((d) => yOffset + d), yOffset];

              plotData.push({
                x: xClosed,
                y: yClosed,
                name: seg === 0 ? series.category : undefined, // Only show legend for first segment
                type: plotType,
                mode: "lines",
                fill: "toself",
                fillcolor: `${segColor}60`, // Semi-transparent
                line: {
                  color: segColor,
                  width: seg === 0 ? 2 : 0, // Only outline on first segment
                },
                visible: series.visible,
                showlegend: seg === 0 ? series.showlegend !== false : false,
                legendgroup: series.legendgroup,
                hovertemplate:
                  series.hovertemplate ||
                  `<b>${series.category}</b><br>Value: %{x:.1f}<br>Density: %{y:.3f}<extra></extra>`,
                hoverinfo: series.hoverinfo,
                customdata: series.customdata,
              } as any as PlotData);
            }
          }
        }

        // Add a light border outline for the entire mountain in gradient mode
        const xClosed = [xPoints[0], ...xPoints, xPoints[xPoints.length - 1]];
        const yClosed = [yOffset, ...normalizedDensity.map((d) => yOffset + d), yOffset];

        plotData.push({
          x: xClosed,
          y: yClosed,
          name: undefined, // No legend for border
          type: plotType,
          mode: "lines",
          fill: "none",
          line: {
            color: "rgba(255, 255, 255, 0.3)", // Light white border
            width: 1,
          },
          visible: series.visible,
          showlegend: false,
          hoverinfo: "skip", // Skip hover for border
        } as any as PlotData);
      } else {
        // Solid color mode (original behavior)
        const xClosed = [xPoints[0], ...xPoints, xPoints[xPoints.length - 1]];
        const yClosed = [yOffset, ...normalizedDensity.map((d) => yOffset + d), yOffset];

        plotData.push({
          x: xClosed,
          y: yClosed,
          name: series.category,
          type: plotType,
          mode: "lines",
          fill: "toself",
          fillcolor: fillColor,
          line: {
            color: "rgba(255, 255, 255, 0.4)", // Light white border
            width: 1,
          },
          visible: series.visible,
          showlegend: series.showlegend !== false,
          legendgroup: series.legendgroup,
          hovertemplate:
            series.hovertemplate ||
            `<b>${series.category}</b><br>Value: %{x:.1f}<br>Density: %{y:.3f}<extra></extra>`,
          hoverinfo: series.hoverinfo,
          customdata: series.customdata,
        } as any as PlotData);
      }
    } else {
      // Just the outline without fill
      const yPoints = normalizedDensity.map((d) => yOffset + d);

      plotData.push({
        x: xPoints,
        y: yPoints,
        name: series.category,
        type: plotType,
        mode: "lines",
        line: {
          color: lineColor,
          width: 2,
        },
        visible: series.visible,
        showlegend: series.showlegend !== false,
        legendgroup: series.legendgroup,
        hovertemplate:
          series.hovertemplate ||
          `<b>${series.category}</b><br>Value: %{x:.1f}<br>Density: %{y:.3f}<extra></extra>`,
        hoverinfo: series.hoverinfo,
        customdata: series.customdata,
      } as any as PlotData);
    }
  });

  const plotConfig = createPlotlyConfig(config);

  // Create custom layout for ridge plots
  const layout = {
    ...createBaseLayout(config),
    xaxis: {
      ...createBaseLayout(config).xaxis,
      autorange: true,
      type: "linear" as const,
      title: config.xAxisTitle ? { text: config.xAxisTitle } : undefined,
    },
    yaxis: {
      ...createBaseLayout(config).yaxis,
      tickvals: data.map((_, index) => index * spacing),
      ticktext: data.map((series) => series.category),
      range: [-0.5, (data.length - 1) * spacing + 1],
      title: config.yAxis?.[0]?.title ? { text: config.yAxis[0].title } : undefined,
    },
  };

  return (
    <div className={className}>
      <PlotlyChart
        data={plotData}
        layout={layout}
        config={plotConfig}
        loading={loading}
        error={error}
      />
    </div>
  );
}
