"use client";

import type { PlotData } from "plotly.js";
import React from "react";

import type { BaseChartProps, BaseSeries } from "../../common";
import {
  PlotlyChart,
  create3DLayout,
  createPlotlyConfig,
  getRenderer,
  getPlotType,
} from "../../common";

export interface Surface3DSeriesData extends BaseSeries {
  x?: (string | number | Date)[];
  y?: (string | number | Date)[];
  z: (string | number)[][];
  surfacecolor?: (string | number)[][];
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
  contours?: {
    x?: {
      show?: boolean;
      start?: number;
      end?: number;
      size?: number;
      color?: string;
      width?: number;
      highlight?: boolean;
      highlightcolor?: string;
      highlightwidth?: number;
    };
    y?: {
      show?: boolean;
      start?: number;
      end?: number;
      size?: number;
      color?: string;
      width?: number;
      highlight?: boolean;
      highlightcolor?: string;
      highlightwidth?: number;
    };
    z?: {
      show?: boolean;
      start?: number;
      end?: number;
      size?: number;
      color?: string;
      width?: number;
      highlight?: boolean;
      highlightcolor?: string;
      highlightwidth?: number;
    };
  };
  lighting?: {
    ambient?: number;
    diffuse?: number;
    specular?: number;
    roughness?: number;
    fresnel?: number;
  };
  lightposition?: {
    x?: number;
    y?: number;
    z?: number;
  };
  hidesurface?: boolean;
  opacity?: number;
  reversescale?: boolean;
  showcontours?: boolean;
}

export interface Surface3DProps extends BaseChartProps {
  data: Surface3DSeriesData[];
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

export function Surface3D({
  data,
  config = {},
  className,
  loading,
  error,
  scene = {},
}: Surface3DProps) {
  const renderer = getRenderer(config.useWebGL);
  const plotType = getPlotType("surface", renderer);

  const plotData: PlotData[] = data.map(
    (series) =>
      ({
        x: series.x,
        y: series.y,
        z: series.z,
        surfacecolor: series.surfacecolor,
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

        // Contour lines
        contours: series.contours
          ? {
              x: series.contours.x
                ? {
                    show: series.contours.x.show !== false,
                    start: series.contours.x.start,
                    end: series.contours.x.end,
                    size: series.contours.x.size,
                    color: series.contours.x.color || "rgba(0,0,0,0.5)",
                    width: series.contours.x.width || 1,
                    highlight: series.contours.x.highlight !== false,
                    highlightcolor: series.contours.x.highlightcolor || "rgba(0,0,0,0.8)",
                    highlightwidth: series.contours.x.highlightwidth || 2,
                  }
                : { show: false },
              y: series.contours.y
                ? {
                    show: series.contours.y.show !== false,
                    start: series.contours.y.start,
                    end: series.contours.y.end,
                    size: series.contours.y.size,
                    color: series.contours.y.color || "rgba(0,0,0,0.5)",
                    width: series.contours.y.width || 1,
                    highlight: series.contours.y.highlight !== false,
                    highlightcolor: series.contours.y.highlightcolor || "rgba(0,0,0,0.8)",
                    highlightwidth: series.contours.y.highlightwidth || 2,
                  }
                : { show: false },
              z: series.contours.z
                ? {
                    show: series.contours.z.show !== false,
                    start: series.contours.z.start,
                    end: series.contours.z.end,
                    size: series.contours.z.size,
                    color: series.contours.z.color || "rgba(0,0,0,0.5)",
                    width: series.contours.z.width || 1,
                    highlight: series.contours.z.highlight !== false,
                    highlightcolor: series.contours.z.highlightcolor || "rgba(0,0,0,0.8)",
                    highlightwidth: series.contours.z.highlightwidth || 2,
                  }
                : { show: false },
            }
          : undefined,

        // Lighting and material properties
        lighting: series.lighting || {
          ambient: 0.8,
          diffuse: 1,
          specular: 0.05,
          roughness: 0.1,
          fresnel: 0.2,
        },
        lightposition: series.lightposition || {
          x: 100,
          y: 200,
          z: 0,
        },

        hidesurface: series.hidesurface || false,
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

// Parametric surface plot
export interface ParametricSurface3DProps extends BaseChartProps {
  x: number[][];
  y: number[][];
  z: number[][];
  name?: string;
  colorscale?: string;
  surfacecolor?: number[][];
}

export function ParametricSurface3D({
  x,
  y,
  z,
  name,
  colorscale = "Viridis",
  surfacecolor,
  ...props
}: ParametricSurface3DProps) {
  return (
    <Surface3D
      data={[
        {
          x: x.flat(),
          y: y.flat(),
          z: z,
          surfacecolor: surfacecolor,
          name: name,
          colorscale: colorscale,
        },
      ]}
      {...props}
    />
  );
}

// Wireframe surface plot
export interface WireframeSurface3DProps extends BaseChartProps {
  x: number[];
  y: number[];
  z: number[][];
  name?: string;
  color?: string;
  lineWidth?: number;
}

export function WireframeSurface3D({
  x,
  y,
  z,
  name,
  color = "blue",
  lineWidth = 1,
  ...props
}: WireframeSurface3DProps) {
  return (
    <Surface3D
      data={[
        {
          x: x,
          y: y,
          z: z,
          name: name,
          hidesurface: true,
          contours: {
            x: { show: true, color: color, width: lineWidth },
            y: { show: true, color: color, width: lineWidth },
            z: { show: false },
          },
          showscale: false,
        },
      ]}
      {...props}
    />
  );
}

// Elevation/terrain map
export interface TerrainMapProps extends BaseChartProps {
  x: number[];
  y: number[];
  elevation: number[][];
  name?: string;
  colorscale?: string;
  showContours?: boolean;
  contourInterval?: number;
}

export function TerrainMap({
  x,
  y,
  elevation,
  name = "Terrain",
  colorscale = "Earth",
  showContours = true,
  contourInterval = 10,
  ...props
}: TerrainMapProps) {
  return (
    <Surface3D
      data={[
        {
          x: x,
          y: y,
          z: elevation,
          name: name,
          colorscale: colorscale,
          contours: showContours
            ? {
                z: {
                  show: true,
                  size: contourInterval,
                  color: "rgba(0,0,0,0.3)",
                  width: 1,
                },
              }
            : undefined,
          lighting: {
            ambient: 0.6,
            diffuse: 1.2,
            specular: 0.1,
            roughness: 0.8,
            fresnel: 0.1,
          },
          colorbar: {
            title: "Elevation",
          },
        },
      ]}
      scene={{
        camera: {
          eye: { x: 2, y: 2, z: 1 },
          projection: { type: "perspective" },
        },
        aspectmode: "manual",
        aspectratio: { x: 1, y: 1, z: 0.3 },
        zaxis: { title: "Elevation" },
      }}
      {...props}
    />
  );
}
