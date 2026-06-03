import { PieChart } from "lucide-react";

import type { ChartTypeDef } from "../../types";
import { pieDefaultConfig, pieDefaultDataConfig } from "./defaults";
import { PieDataPanel } from "./panels/data-panel";
import { PieStylePanel } from "./panels/style-panel";
import { PieRenderer } from "./renderer";
import { pieDataShelves } from "./shelves/data-shelves";
import { pieStyleShelves } from "./shelves/style-shelves";

export const pieChartType: ChartTypeDef = {
  type: "pie",
  family: "basic",
  labelKey: "workspace.charts.types.pie",
  descriptionKey: "workspace.charts.descriptions.pie",
  icon: PieChart,
  defaultConfig: pieDefaultConfig,
  defaultDataConfig: pieDefaultDataConfig,
  DataPanel: PieDataPanel,
  StylePanel: PieStylePanel,
  Renderer: PieRenderer,
  dataShelves: pieDataShelves,
  styleShelves: pieStyleShelves,
};
