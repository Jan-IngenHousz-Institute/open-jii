import { Radar } from "lucide-react";

import type { ChartTypeDef } from "../../types";
import { radarDefaultConfig, radarDefaultDataConfig } from "./defaults";
import { RadarDataPanel } from "./panels/data-panel";
import { RadarStylePanel } from "./panels/style-panel";
import { RadarRenderer } from "./renderer";
import { radarDataShelves } from "./shelves/data-shelves";
import { radarStyleShelves } from "./shelves/style-shelves";

export const radarChartType: ChartTypeDef = {
  type: "radar",
  family: "scientific",
  labelKey: "workspace.charts.types.radar",
  descriptionKey: "workspace.charts.descriptions.radar",
  icon: Radar,
  defaultConfig: radarDefaultConfig,
  defaultDataConfig: radarDefaultDataConfig,
  DataPanel: RadarDataPanel,
  StylePanel: RadarStylePanel,
  Renderer: RadarRenderer,
  dataShelves: radarDataShelves,
  styleShelves: radarStyleShelves,
};
