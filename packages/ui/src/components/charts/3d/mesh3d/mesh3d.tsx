"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import type { BaseChartProps, BaseSeries, SafeLayout } from "../../common";
import {
  PlotlyChart,
  create3DLayout,
  createPlotlyConfig,
  getRenderer,
  getPlotType,
} from "../../common";

export interface Mesh3DSeriesData extends BaseSeries {
  x: number[];
  y: number[];
  z: number[];
  i?: number[]; // Indices for first vertex of triangles
  j?: number[]; // Indices for second vertex of triangles
  k?: number[]; // Indices for third vertex of triangles
  intensity?: number[]; // Color intensity values
  vertexcolor?: (string | number)[];
  facecolor?: (string | number)[];
  colorscale?: string | Array<[number, string]>;
  showscale?: boolean;
  cmin?: number;
  cmax?: number;
  cmid?: number;
  colorbar?: {
    title?: string;
    titleside?: "right" | "top" | "bottom";
    thickness?: number;
    len?: number;
    x?: number;
    y?: number;
  };
  contour?: {
    show?: boolean;
    color?: string;
    width?: number;
  };
  flatshading?: boolean;
  lighting?: {
    ambient?: number;
    diffuse?: number;
    specular?: number;
    roughness?: number;
    fresnel?: number;
    vertexnormalsepsilon?: number;
    facenormalsepsilon?: number;
  };
  lightposition?: {
    x?: number;
    y?: number;
    z?: number;
  };
  alphahull?: number;
  delaunayaxis?: "x" | "y" | "z";
  opacity?: number;
  reversescale?: boolean;
}

export interface Mesh3DProps extends BaseChartProps {
  data: Mesh3DSeriesData[];
  scene?: {
    camera?: {
      eye?: { x?: number; y?: number; z?: number };
      center?: { x?: number; y?: number; z?: number };
      up?: { x?: number; y?: number; z?: number };
      projection?: { type?: "perspective" | "orthographic" };
    };
    aspectmode?: "auto" | "cube" | "data" | "manual";
    aspectratio?: { x?: number; y?: number; z?: number };
    xaxis?: {
      title?: string;
      type?: "linear" | "log" | "date" | "category";
      range?: [number, number];
      autorange?: boolean;
      showgrid?: boolean;
      gridcolor?: string;
      showbackground?: boolean;
      backgroundcolor?: string;
    };
    yaxis?: {
      title?: string;
      type?: "linear" | "log" | "date" | "category";
      range?: [number, number];
      autorange?: boolean;
      showgrid?: boolean;
      gridcolor?: string;
      showbackground?: boolean;
      backgroundcolor?: string;
    };
    zaxis?: {
      title?: string;
      type?: "linear" | "log" | "date" | "category";
      range?: [number, number];
      autorange?: boolean;
      showgrid?: boolean;
      gridcolor?: string;
      showbackground?: boolean;
      backgroundcolor?: string;
    };
  };
}

export function Mesh3D({ data, config = {}, className, loading, error, scene = {} }: Mesh3DProps) {
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("mesh3d", renderer);

  const plotData: PlotData[] = data.map(
    (series) =>
      ({
        x: series.x,
        y: series.y,
        z: series.z,
        i: series.i,
        j: series.j,
        k: series.k,
        intensity: series.intensity,
        vertexcolor: series.vertexcolor,
        facecolor: series.facecolor,
        name: series.name,
        type: plotType,

        // Color configuration
        colorscale: series.colorscale || "Viridis",
        showscale: series.showscale !== false,
        cmin: series.cmin,
        cmax: series.cmax,
        cmid: series.cmid,
        reversescale: series.reversescale || false,
        colorbar: series.colorbar || {
          title: "Value",
          titleside: "right",
        },

        // Contour/edge lines
        contour: series.contour
          ? {
              show: series.contour.show !== false,
              color: series.contour.color || "rgb(0,0,0)",
              width: series.contour.width || 1,
            }
          : { show: false },

        // Shading and lighting
        flatshading: series.flatshading || false,
        lighting: series.lighting || {
          ambient: 0.8,
          diffuse: 1,
          specular: 0.05,
          roughness: 0.1,
          fresnel: 0.2,
          vertexnormalsepsilon: 1e-12,
          facenormalsepsilon: 1e-6,
        },
        lightposition: series.lightposition || {
          x: 100,
          y: 200,
          z: 0,
        },

        // Hull construction
        alphahull: series.alphahull,
        delaunayaxis: series.delaunayaxis || "z",

        opacity: series.opacity || 1,

        visible: series.visible,
        showlegend: series.showlegend,
        legendgroup: series.legendgroup,
        hovertemplate: series.hovertemplate,
        hoverinfo: series.hoverinfo,
        customdata: series.customdata,
      }) as any as PlotData,
  );

  const layout = create3DLayout(config);

  // Add 3D scene configuration
  (layout as any).scene = {
    // Layout type allows flexible scene property assignment
    camera: scene.camera || {
      eye: { x: 1.87, y: 0.88, z: -0.64 },
      projection: { type: "perspective" },
    },
    aspectmode: scene.aspectmode || "auto",
    aspectratio: scene.aspectratio,
    xaxis: {
      title: scene.xaxis?.title || config.xAxisTitle || "X",
      type: scene.xaxis?.type,
      range: scene.xaxis?.range,
      autorange: scene.xaxis?.autorange !== false,
      showgrid: scene.xaxis?.showgrid !== false,
      gridcolor: scene.xaxis?.gridcolor || "#E6E6E6",
      showbackground: scene.xaxis?.showbackground !== false,
      backgroundcolor: scene.xaxis?.backgroundcolor || "rgba(204, 204, 204, 0.5)",
    },
    yaxis: {
      title: scene.yaxis?.title || config.yAxisTitle || "Y",
      type: scene.yaxis?.type,
      range: scene.yaxis?.range,
      autorange: scene.yaxis?.autorange !== false,
      showgrid: scene.yaxis?.showgrid !== false,
      gridcolor: scene.yaxis?.gridcolor || "#E6E6E6",
      showbackground: scene.yaxis?.showbackground !== false,
      backgroundcolor: scene.yaxis?.backgroundcolor || "rgba(204, 204, 204, 0.5)",
    },
    zaxis: {
      title: scene.zaxis?.title || config.zAxisTitle || "Z",
      type: scene.zaxis?.type,
      range: scene.zaxis?.range,
      autorange: scene.zaxis?.autorange !== false,
      showgrid: scene.zaxis?.showgrid !== false,
      gridcolor: scene.zaxis?.gridcolor || "#E6E6E6",
      showbackground: scene.zaxis?.showbackground !== false,
      backgroundcolor: scene.zaxis?.backgroundcolor || "rgba(204, 204, 204, 0.5)",
    },
  };

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

// Simple convex hull mesh
export interface ConvexHull3DProps extends BaseChartProps {
  x: number[];
  y: number[];
  z: number[];
  name?: string;
  color?: string;
  opacity?: number;
  showEdges?: boolean;
}

export function ConvexHull3D({
  x,
  y,
  z,
  name,
  color = "lightblue",
  opacity = 0.7,
  showEdges = true,
  ...props
}: ConvexHull3DProps) {
  return (
    <Mesh3D
      data={[
        {
          x: x,
          y: y,
          z: z,
          name: name,
          facecolor: [color],
          opacity: opacity,
          contour: showEdges
            ? {
                show: true,
                color: "rgb(0,0,0)",
                width: 1,
              }
            : { show: false },
          alphahull: 0, // Convex hull
        },
      ]}
      {...props}
    />
  );
}
