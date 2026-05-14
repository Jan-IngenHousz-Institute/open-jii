import { Grid3x3 } from "lucide-react";

import type { ChartTypeDef } from "../../types";
import { histogram2DDefaultConfig, histogram2DDefaultDataConfig } from "./defaults";
import { Histogram2DDataPanel } from "./panels/data-panel";
import { Histogram2DStylePanel } from "./panels/style-panel";
import { Histogram2DRenderer } from "./renderer";
import { histogram2DDataShelves } from "./shelves/data-shelves";
import { histogram2DStyleShelves } from "./shelves/style-shelves";

export const histogram2DChartType: ChartTypeDef = {
  type: "histogram-2d",
  family: "statistical",
  labelKey: "workspace.charts.types.histogram2d",
  descriptionKey: "workspace.charts.descriptions.histogram2d",
  icon: Grid3x3,
  defaultConfig: histogram2DDefaultConfig,
  defaultDataConfig: histogram2DDefaultDataConfig,
  DataPanel: Histogram2DDataPanel,
  StylePanel: Histogram2DStylePanel,
  Renderer: Histogram2DRenderer,
  dataShelves: histogram2DDataShelves,
  styleShelves: histogram2DStyleShelves,
};
