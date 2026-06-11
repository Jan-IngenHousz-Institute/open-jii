import { Circle } from "lucide-react";

import type { ChartTypeDef } from "../../types";
import { dotPlotDefaultConfig, dotPlotDefaultDataConfig } from "./defaults";
import { DotPlotDataPanel } from "./panels/data-panel";
import { DotPlotStylePanel } from "./panels/style-panel";
import { DotPlotRenderer } from "./renderer";
import { dotPlotDataShelves } from "./shelves/data-shelves";
import { dotPlotStyleShelves } from "./shelves/style-shelves";

export const dotPlotChartType: ChartTypeDef = {
  type: "dot-plot",
  family: "basic",
  labelKey: "workspace.charts.types.dot-plot",
  descriptionKey: "workspace.charts.descriptions.dot-plot",
  icon: Circle,
  defaultConfig: dotPlotDefaultConfig,
  defaultDataConfig: dotPlotDefaultDataConfig,
  DataPanel: DotPlotDataPanel,
  StylePanel: DotPlotStylePanel,
  Renderer: DotPlotRenderer,
  dataShelves: dotPlotDataShelves,
  styleShelves: dotPlotStyleShelves,
};
