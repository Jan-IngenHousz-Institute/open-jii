import { Crosshair } from "lucide-react";

import type { ChartTypeDef } from "../../types";
import { densityPlot2DDefaultConfig, densityPlot2DDefaultDataConfig } from "./defaults";
import { DensityPlot2DDataPanel } from "./panels/data-panel";
import { DensityPlot2DStylePanel } from "./panels/style-panel";
import { DensityPlot2DRenderer } from "./renderer";
import { densityPlot2DDataShelves } from "./shelves/data-shelves";
import { densityPlot2DStyleShelves } from "./shelves/style-shelves";

export const densityPlot2DChartType: ChartTypeDef = {
  type: "density-plot-2d",
  family: "statistical",
  labelKey: "workspace.charts.types.densityPlot2d",
  descriptionKey: "workspace.charts.descriptions.densityPlot2d",
  icon: Crosshair,
  defaultConfig: densityPlot2DDefaultConfig,
  defaultDataConfig: densityPlot2DDefaultDataConfig,
  DataPanel: DensityPlot2DDataPanel,
  StylePanel: DensityPlot2DStylePanel,
  Renderer: DensityPlot2DRenderer,
  dataShelves: densityPlot2DDataShelves,
  styleShelves: densityPlot2DStyleShelves,
};
