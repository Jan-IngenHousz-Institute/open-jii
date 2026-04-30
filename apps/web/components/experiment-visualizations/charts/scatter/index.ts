import { ScatterChart } from "lucide-react";

import type { ChartTypeDef } from "../types";
import { ScatterDataPanel } from "./data-panel";
import { scatterDefaultConfig, scatterDefaultDataConfig } from "./defaults";
import { ScatterRenderer } from "./renderer";
import { ScatterStylePanel } from "./style-panel";

export const scatterChartType: ChartTypeDef = {
  type: "scatter",
  family: "basic",
  labelKey: "workspace.charts.types.scatter",
  descriptionKey: "workspace.charts.descriptions.scatter",
  icon: ScatterChart,
  defaultConfig: scatterDefaultConfig,
  defaultDataConfig: scatterDefaultDataConfig,
  DataPanel: ScatterDataPanel,
  StylePanel: ScatterStylePanel,
  Renderer: ScatterRenderer,
};
