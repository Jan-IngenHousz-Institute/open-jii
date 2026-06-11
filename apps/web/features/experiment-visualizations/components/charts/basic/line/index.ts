import { LineChart } from "lucide-react";

import type { ChartTypeDef } from "../../types";
import { lineDefaultConfig, lineDefaultDataConfig } from "./defaults";
import { LineDataPanel } from "./panels/data-panel";
import { LineStylePanel } from "./panels/style-panel";
import { LineRenderer } from "./renderer";
import { lineDataShelves } from "./shelves/data-shelves";
import { lineStyleShelves } from "./shelves/style-shelves";

export const lineChartType: ChartTypeDef = {
  type: "line",
  family: "basic",
  labelKey: "workspace.charts.types.line",
  descriptionKey: "workspace.charts.descriptions.line",
  icon: LineChart,
  defaultConfig: lineDefaultConfig,
  defaultDataConfig: lineDefaultDataConfig,
  DataPanel: LineDataPanel,
  StylePanel: LineStylePanel,
  Renderer: LineRenderer,
  dataShelves: lineDataShelves,
  styleShelves: lineStyleShelves,
};
