import { Mountain } from "lucide-react";

import type { ChartTypeDef } from "../../types";
import { ridgePlotDefaultConfig, ridgePlotDefaultDataConfig } from "./defaults";
import { RidgePlotDataPanel } from "./panels/data-panel";
import { RidgePlotStylePanel } from "./panels/style-panel";
import { RidgePlotRenderer } from "./renderer";
import { ridgePlotDataShelves } from "./shelves/data-shelves";
import { ridgePlotStyleShelves } from "./shelves/style-shelves";

export const ridgePlotChartType: ChartTypeDef = {
  type: "ridge-plot",
  family: "statistical",
  labelKey: "workspace.charts.types.ridgePlot",
  descriptionKey: "workspace.charts.descriptions.ridgePlot",
  icon: Mountain,
  defaultConfig: ridgePlotDefaultConfig,
  defaultDataConfig: ridgePlotDefaultDataConfig,
  DataPanel: RidgePlotDataPanel,
  StylePanel: RidgePlotStylePanel,
  Renderer: RidgePlotRenderer,
  dataShelves: ridgePlotDataShelves,
  styleShelves: ridgePlotStyleShelves,
};
