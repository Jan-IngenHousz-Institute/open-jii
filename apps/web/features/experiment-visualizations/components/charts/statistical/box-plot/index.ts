import { Columns3 } from "lucide-react";

import type { ChartTypeDef } from "../../types";
import { boxPlotDefaultConfig, boxPlotDefaultDataConfig } from "./defaults";
import { BoxPlotDataPanel } from "./panels/data-panel";
import { BoxPlotStylePanel } from "./panels/style-panel";
import { BoxPlotRenderer } from "./renderer";
import { boxPlotDataShelves } from "./shelves/data-shelves";
import { boxPlotStyleShelves } from "./shelves/style-shelves";

export const boxPlotChartType: ChartTypeDef = {
  type: "box-plot",
  family: "statistical",
  labelKey: "workspace.charts.types.boxPlot",
  descriptionKey: "workspace.charts.descriptions.boxPlot",
  icon: Columns3,
  defaultConfig: boxPlotDefaultConfig,
  defaultDataConfig: boxPlotDefaultDataConfig,
  DataPanel: BoxPlotDataPanel,
  StylePanel: BoxPlotStylePanel,
  Renderer: BoxPlotRenderer,
  dataShelves: boxPlotDataShelves,
  styleShelves: boxPlotStyleShelves,
};
