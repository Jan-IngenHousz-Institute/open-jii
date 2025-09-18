"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import type { BaseChartProps, BaseSeries } from "../../common";
import {
  PlotlyChart,
  createPlotlyConfig,
  getRenderer,
  getPlotType,
  create3DLayout,
} from "../../common";

export interface ClusterSeriesData extends BaseSeries {
  x: number[];
  y: number[];
  z: number[];
  cluster?: number[] | string[]; // Cluster labels
  text?: string | string[];
  mode?: "markers" | "lines" | "lines+markers" | "text" | "markers+text";
  marker?: {
    color?: string | string[] | number[];
    size?: number | number[];
    symbol?: string | string[];
    colorscale?: string;
    showscale?: boolean;
    sizemode?: "diameter" | "area";
    sizeref?: number;
    sizemin?: number;
    opacity?: number;
    line?: {
      color?: string | string[];
      width?: number | number[];
    };
  };
  line?: {
    color?: string;
    width?: number;
    dash?: string;
  };
}

export interface PointClustering3DProps extends BaseChartProps {
  data: ClusterSeriesData[];
  clusterColors?: string[];
  showClusterCenters?: boolean;
  clusterCenterSize?: number;
  clusterCenterSymbol?: string;
  scene?: {
    camera?: {
      eye?: { x?: number; y?: number; z?: number };
      center?: { x?: number; y?: number; z?: number };
      up?: { x?: number; y?: number; z?: number };
    };
    xaxis?: { title?: string };
    yaxis?: { title?: string };
    zaxis?: { title?: string };
  };
}

export function PointClustering3D({
  data,
  config = {},
  className,
  loading,
  error,
  clusterColors = [],
  showClusterCenters = false,
  clusterCenterSize = 20,
  clusterCenterSymbol = "x",
  scene = {},
}: PointClustering3DProps) {
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("scatter3d", renderer);

  // Generate cluster colors if not provided
  const getClusterColor = (index: number): string => {
    if (clusterColors[index]) return clusterColors[index]!;
    return `hsl(${index * 60}, 70%, 50%)`;
  };

  const plotData: PlotData[] = [];

  // Process each series
  data.forEach((series, seriesIndex) => {
    if (series.cluster) {
      // Group points by cluster
      const clusters = new Map<
        string | number,
        { x: number[]; y: number[]; z: number[]; indices: number[] }
      >();

      series.cluster.forEach((clusterLabel, i) => {
        if (!clusters.has(clusterLabel)) {
          clusters.set(clusterLabel, { x: [], y: [], z: [], indices: [] });
        }
        const cluster = clusters.get(clusterLabel)!;
        cluster.x.push(series.x[i]!);
        cluster.y.push(series.y[i]!);
        cluster.z.push(series.z[i]!);
        cluster.indices.push(i);
      });

      // Create traces for each cluster
      let clusterIndex = 0;
      clusters.forEach((clusterData, clusterLabel) => {
        const color = getClusterColor(clusterIndex);

        // Main cluster points
        plotData.push({
          x: clusterData.x,
          y: clusterData.y,
          z: clusterData.z,
          name: `${series.name || "Series"} - Cluster ${clusterLabel}`,
          type: plotType,
          mode: series.mode || "markers",

          marker: {
            color: series.marker?.color || color,
            size: series.marker?.size || 8,
            symbol: series.marker?.symbol || "circle",
            opacity: series.marker?.opacity || series.opacity || 0.8,
            colorscale: series.marker?.colorscale,
            showscale: series.marker?.showscale || false,
            sizemode: series.marker?.sizemode || "diameter",
            sizeref: series.marker?.sizeref,
            sizemin: series.marker?.sizemin,
            line: series.marker?.line
              ? {
                  color: series.marker.line.color || "white",
                  width: series.marker.line.width || 0.5,
                }
              : {
                  color: "white",
                  width: 0.5,
                },
          },

          line: series.line
            ? {
                color: series.line.color || color,
                width: series.line.width || 2,
                dash: series.line.dash || "solid",
              }
            : undefined,

          text: series.text
            ? Array.isArray(series.text)
              ? clusterData.indices.map((i) => series.text![i])
              : series.text
            : clusterData.indices.map((i) => `Point ${i}`),

          visible: series.visible,
          showlegend: series.showlegend,
          legendgroup: `${series.legendgroup || series.name}-${clusterLabel}`,
          hovertemplate:
            series.hovertemplate ||
            `Cluster: ${clusterLabel}<br>X: %{x}<br>Y: %{y}<br>Z: %{z}<extra></extra>`,
          hoverinfo: series.hoverinfo,
          customdata: series.customdata
            ? clusterData.indices.map((i) => series.customdata![i])
            : undefined,
        } as any as PlotData);

        // Cluster center
        if (showClusterCenters) {
          const centerX = clusterData.x.reduce((sum, val) => sum + val, 0) / clusterData.x.length;
          const centerY = clusterData.y.reduce((sum, val) => sum + val, 0) / clusterData.y.length;
          const centerZ = clusterData.z.reduce((sum, val) => sum + val, 0) / clusterData.z.length;

          plotData.push({
            x: [centerX],
            y: [centerY],
            z: [centerZ],
            name: `Cluster ${clusterLabel} Center`,
            type: plotType,
            mode: "markers",

            marker: {
              color: color,
              size: clusterCenterSize,
              symbol: clusterCenterSymbol,
              opacity: 1,
              line: {
                color: "black",
                width: 2,
              },
            },

            showlegend: false,
            hovertemplate: `Cluster ${clusterLabel} Center<br>X: %{x}<br>Y: %{y}<br>Z: %{z}<extra></extra>`,
          } as any as PlotData);
        }

        clusterIndex++;
      });
    } else {
      // No clustering, just add the series as-is
      plotData.push({
        x: series.x,
        y: series.y,
        z: series.z,
        name: series.name,
        type: plotType,
        mode: series.mode || "markers",

        marker: {
          color: series.marker?.color || series.color,
          size: series.marker?.size || 8,
          symbol: series.marker?.symbol || "circle",
          opacity: series.marker?.opacity || series.opacity || 0.8,
          colorscale: series.marker?.colorscale,
          showscale: series.marker?.showscale || false,
          sizemode: series.marker?.sizemode || "diameter",
          sizeref: series.marker?.sizeref,
          sizemin: series.marker?.sizemin,
          line: series.marker?.line,
        },

        line: series.line,
        text: series.text,

        visible: series.visible,
        showlegend: series.showlegend,
        legendgroup: series.legendgroup,
        hovertemplate: series.hovertemplate,
        hoverinfo: series.hoverinfo,
        customdata: series.customdata,
      } as any as PlotData);
    }
  });

  const layout = create3DLayout(config);
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

// Density-based clustering visualization
export interface DensityClusteringProps extends BaseChartProps {
  x: number[];
  y: number[];
  z: number[];
  clusters: (number | string)[];
  densities?: number[];
  name?: string;
  colorByDensity?: boolean;
}

export function DensityClustering({
  x,
  y,
  z,
  clusters,
  densities = [],
  name = "Density Clustering",
  colorByDensity = false,
  ...props
}: DensityClusteringProps) {
  return (
    <PointClustering3D
      data={[
        {
          x: x,
          y: y,
          z: z,
          cluster: clusters as any, // Plotly cluster array type compatibility
          name: name,
          marker:
            colorByDensity && densities.length > 0
              ? {
                  color: densities as any, // Plotly color array type compatibility
                  colorscale: "Viridis",
                  showscale: true,
                  size: densities.map((d) => Math.max(5, d * 15)),
                }
              : undefined,
        },
      ]}
      {...props}
    />
  );
}

// Hierarchical clustering visualization
export interface HierarchicalClusteringProps extends BaseChartProps {
  x: number[];
  y: number[];
  z: number[];
  clusters: number[];
  levels: number[];
  name?: string;
  colorByLevel?: boolean;
}

export function HierarchicalClustering({
  x,
  y,
  z,
  clusters,
  levels,
  name = "Hierarchical Clustering",
  colorByLevel = true,
  ...props
}: HierarchicalClusteringProps) {
  return (
    <PointClustering3D
      data={[
        {
          x: x,
          y: y,
          z: z,
          cluster: clusters,
          name: name,
          marker: colorByLevel
            ? {
                color: levels as any, // Plotly color array type compatibility
                colorscale: "RdYlBu",
                showscale: true,
                size: 8,
              }
            : undefined,
        },
      ]}
      {...props}
    />
  );
}
