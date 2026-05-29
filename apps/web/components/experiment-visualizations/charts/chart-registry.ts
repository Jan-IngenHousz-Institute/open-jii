import type { ChartFamily, ChartType } from "@repo/api/schemas/experiment.schema";

import { areaChartType } from "./basic/area";
import { barChartType } from "./basic/bar";
import { bubbleChartType } from "./basic/bubble";
import { dotPlotChartType } from "./basic/dot-plot";
import { lineChartType } from "./basic/line";
import { lollipopChartType } from "./basic/lollipop";
import { pieChartType } from "./basic/pie";
import { scatterChartType } from "./basic/scatter";
import { alluvialChartType } from "./scientific/alluvial";
import { carpetChartType } from "./scientific/carpet";
import { contourChartType } from "./scientific/contour";
import { correlationMatrixChartType } from "./scientific/correlation-matrix";
import { heatmapChartType } from "./scientific/heatmap";
import { parallelCoordinatesChartType } from "./scientific/parallel-coordinates";
import { polarChartType } from "./scientific/polar";
import { radarChartType } from "./scientific/radar";
import { ternaryChartType } from "./scientific/ternary";
import { windRoseChartType } from "./scientific/wind-rose";
import { boxPlotChartType } from "./statistical/box-plot";
import { densityPlotChartType } from "./statistical/density-plot";
import { densityPlot2DChartType } from "./statistical/density-plot-2d";
import { histogramChartType } from "./statistical/histogram";
import { histogram2DChartType } from "./statistical/histogram-2d";
import { ridgePlotChartType } from "./statistical/ridge-plot";
import { spcControlChartType } from "./statistical/spc-control-chart";
import { violinPlotChartType } from "./statistical/violin-plot";
import type { ChartTypeDef } from "./types";

const REGISTRY: Record<ChartType, ChartTypeDef> = {
  line: lineChartType,
  scatter: scatterChartType,
  bar: barChartType,
  area: areaChartType,
  "dot-plot": dotPlotChartType,
  lollipop: lollipopChartType,
  bubble: bubbleChartType,
  pie: pieChartType,
  histogram: histogramChartType,
  "box-plot": boxPlotChartType,
  "violin-plot": violinPlotChartType,
  "density-plot": densityPlotChartType,
  "ridge-plot": ridgePlotChartType,
  "histogram-2d": histogram2DChartType,
  "density-plot-2d": densityPlot2DChartType,
  "spc-control-chart": spcControlChartType,
  heatmap: heatmapChartType,
  contour: contourChartType,
  "correlation-matrix": correlationMatrixChartType,
  "parallel-coordinates": parallelCoordinatesChartType,
  radar: radarChartType,
  polar: polarChartType,
  "wind-rose": windRoseChartType,
  ternary: ternaryChartType,
  alluvial: alluvialChartType,
  carpet: carpetChartType,
};

export function getChartTypeDef(type: ChartType): ChartTypeDef {
  return REGISTRY[type];
}

export function listChartTypes(): ChartTypeDef[] {
  return Object.values(REGISTRY);
}

export function listChartTypesByFamily(): Record<ChartFamily, ChartTypeDef[]> {
  const grouped: Record<ChartFamily, ChartTypeDef[]> = {
    basic: [],
    scientific: [],
    "3d": [],
    statistical: [],
  };
  for (const def of listChartTypes()) {
    grouped[def.family].push(def);
  }
  return grouped;
}
