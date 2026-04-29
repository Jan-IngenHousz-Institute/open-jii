import { LineChart } from "lucide-react";

import type { ChartTypeDef } from "../types";
import { LineDataPanel } from "./data-panel";
import { lineDefaultConfig, lineDefaultDataConfig } from "./defaults";
import { LineRenderer } from "./renderer";
import { LineStylePanel } from "./style-panel";

export const lineChartType: ChartTypeDef = {
  type: "line",
  family: "basic",
  labelKey: "workspace.charts.types.line",
  descriptionKey: "workspace.charts.descriptions.line",
  icon: LineChart,
  requiredRoles: ["x", "y"],
  defaultConfig: lineDefaultConfig,
  defaultDataConfig: lineDefaultDataConfig,
  DataPanel: LineDataPanel,
  StylePanel: LineStylePanel,
  Renderer: LineRenderer,
};
