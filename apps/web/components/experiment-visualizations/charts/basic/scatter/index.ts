import { ScatterChart } from "lucide-react";

import type { ChartTypeDef } from "../../types";
import { scatterDefaultConfig, scatterDefaultDataConfig } from "./defaults";
import { ScatterDataPanel } from "./panels/data-panel";
import { ScatterStylePanel } from "./panels/style-panel";
import { ScatterRenderer } from "./renderer";
import { scatterDataShelves } from "./shelves/data-shelves";
import { scatterStyleShelves } from "./shelves/style-shelves";

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
  dataShelves: scatterDataShelves,
  styleShelves: scatterStyleShelves,
};
