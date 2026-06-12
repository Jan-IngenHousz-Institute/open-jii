import { ChartSpline } from "lucide-react";

import type { ChartTypeDef } from "../../types";
import { densityPlotDefaultConfig, densityPlotDefaultDataConfig } from "./defaults";
import { DensityPlotDataPanel } from "./panels/data-panel";
import { DensityPlotStylePanel } from "./panels/style-panel";
import { DensityPlotRenderer } from "./renderer";
import { densityPlotDataShelves } from "./shelves/data-shelves";
import { densityPlotStyleShelves } from "./shelves/style-shelves";

export const densityPlotChartType: ChartTypeDef = {
  type: "density-plot",
  family: "statistical",
  labelKey: "workspace.charts.types.densityPlot",
  descriptionKey: "workspace.charts.descriptions.densityPlot",
  icon: ChartSpline,
  defaultConfig: densityPlotDefaultConfig,
  defaultDataConfig: densityPlotDefaultDataConfig,
  DataPanel: DensityPlotDataPanel,
  StylePanel: DensityPlotStylePanel,
  Renderer: DensityPlotRenderer,
  dataShelves: densityPlotDataShelves,
  styleShelves: densityPlotStyleShelves,
};
