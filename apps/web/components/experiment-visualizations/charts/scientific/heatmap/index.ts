import { Grid2X2 } from "lucide-react";

import type { ChartTypeDef } from "../../types";
import { heatmapDefaultConfig, heatmapDefaultDataConfig } from "./defaults";
import { HeatmapDataPanel } from "./panels/data-panel";
import { HeatmapStylePanel } from "./panels/style-panel";
import { HeatmapRenderer } from "./renderer";
import { heatmapDataShelves } from "./shelves/data-shelves";
import { heatmapStyleShelves } from "./shelves/style-shelves";

export const heatmapChartType: ChartTypeDef = {
  type: "heatmap",
  family: "scientific",
  labelKey: "workspace.charts.types.heatmap",
  descriptionKey: "workspace.charts.descriptions.heatmap",
  icon: Grid2X2,
  defaultConfig: heatmapDefaultConfig,
  defaultDataConfig: heatmapDefaultDataConfig,
  DataPanel: HeatmapDataPanel,
  StylePanel: HeatmapStylePanel,
  Renderer: HeatmapRenderer,
  dataShelves: heatmapDataShelves,
  styleShelves: heatmapStyleShelves,
};
