import { Waves } from "lucide-react";

import type { ChartTypeDef } from "../../types";
import { violinPlotDefaultConfig, violinPlotDefaultDataConfig } from "./defaults";
import { ViolinPlotDataPanel } from "./panels/data-panel";
import { ViolinPlotStylePanel } from "./panels/style-panel";
import { ViolinPlotRenderer } from "./renderer";
import { violinPlotDataShelves } from "./shelves/data-shelves";
import { violinPlotStyleShelves } from "./shelves/style-shelves";

export const violinPlotChartType: ChartTypeDef = {
  type: "violin-plot",
  family: "statistical",
  labelKey: "workspace.charts.types.violinPlot",
  descriptionKey: "workspace.charts.descriptions.violinPlot",
  icon: Waves,
  defaultConfig: violinPlotDefaultConfig,
  defaultDataConfig: violinPlotDefaultDataConfig,
  DataPanel: ViolinPlotDataPanel,
  StylePanel: ViolinPlotStylePanel,
  Renderer: ViolinPlotRenderer,
  dataShelves: violinPlotDataShelves,
  styleShelves: violinPlotStyleShelves,
};
