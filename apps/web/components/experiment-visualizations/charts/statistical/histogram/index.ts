import { BarChart3 } from "lucide-react";

import type { ChartTypeDef } from "../../types";
import { histogramDefaultConfig, histogramDefaultDataConfig } from "./defaults";
import { HistogramDataPanel } from "./panels/data-panel";
import { HistogramStylePanel } from "./panels/style-panel";
import { HistogramRenderer } from "./renderer";
import { histogramDataShelves } from "./shelves/data-shelves";
import { histogramStyleShelves } from "./shelves/style-shelves";

export const histogramChartType: ChartTypeDef = {
  type: "histogram",
  family: "statistical",
  labelKey: "workspace.charts.types.histogram",
  descriptionKey: "workspace.charts.descriptions.histogram",
  icon: BarChart3,
  defaultConfig: histogramDefaultConfig,
  defaultDataConfig: histogramDefaultDataConfig,
  DataPanel: HistogramDataPanel,
  StylePanel: HistogramStylePanel,
  Renderer: HistogramRenderer,
  dataShelves: histogramDataShelves,
  styleShelves: histogramStyleShelves,
};
