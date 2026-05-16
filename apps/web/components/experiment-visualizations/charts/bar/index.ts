import { BarChart3 } from "lucide-react";

import type { ChartTypeDef } from "../types";
import { BarDataPanel } from "./data-panel";
import { barDefaultConfig, barDefaultDataConfig } from "./defaults";
import { BarRenderer } from "./renderer";
import { BarStylePanel } from "./style-panel";

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
};
