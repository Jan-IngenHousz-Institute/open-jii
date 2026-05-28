import { BarChart3 } from "lucide-react";

import type { ChartTypeDef } from "../../types";
import { barDefaultConfig, barDefaultDataConfig } from "./defaults";
import { BarDataPanel } from "./panels/data-panel";
import { BarStylePanel } from "./panels/style-panel";
import { BarRenderer } from "./renderer";
import { barDataShelves } from "./shelves/data-shelves";
import { barStyleShelves } from "./shelves/style-shelves";

export const barChartType: ChartTypeDef = {
  type: "bar",
  family: "basic",
  labelKey: "workspace.charts.types.bar",
  descriptionKey: "workspace.charts.descriptions.bar",
  icon: BarChart3,
  defaultConfig: barDefaultConfig,
  defaultDataConfig: barDefaultDataConfig,
  DataPanel: BarDataPanel,
  StylePanel: BarStylePanel,
  Renderer: BarRenderer,
  dataShelves: barDataShelves,
  styleShelves: barStyleShelves,
};
