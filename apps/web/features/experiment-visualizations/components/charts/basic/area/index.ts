import { AreaChart } from "lucide-react";

import type { ChartTypeDef } from "../../types";
import { areaDefaultConfig, areaDefaultDataConfig } from "./defaults";
import { AreaDataPanel } from "./panels/data-panel";
import { AreaStylePanel } from "./panels/style-panel";
import { AreaRenderer } from "./renderer";
import { areaDataShelves } from "./shelves/data-shelves";
import { areaStyleShelves } from "./shelves/style-shelves";

export const areaChartType: ChartTypeDef = {
  type: "area",
  family: "basic",
  labelKey: "workspace.charts.types.area",
  descriptionKey: "workspace.charts.descriptions.area",
  icon: AreaChart,
  defaultConfig: areaDefaultConfig,
  defaultDataConfig: areaDefaultDataConfig,
  DataPanel: AreaDataPanel,
  StylePanel: AreaStylePanel,
  Renderer: AreaRenderer,
  dataShelves: areaDataShelves,
  styleShelves: areaStyleShelves,
};
