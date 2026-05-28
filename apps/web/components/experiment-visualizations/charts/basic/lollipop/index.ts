import { Candy } from "lucide-react";

import type { ChartTypeDef } from "../../types";
import { lollipopDefaultConfig, lollipopDefaultDataConfig } from "./defaults";
import { LollipopDataPanel } from "./panels/data-panel";
import { LollipopStylePanel } from "./panels/style-panel";
import { LollipopRenderer } from "./renderer";
import { lollipopDataShelves } from "./shelves/data-shelves";
import { lollipopStyleShelves } from "./shelves/style-shelves";

export const lollipopChartType: ChartTypeDef = {
  type: "lollipop",
  family: "basic",
  labelKey: "workspace.charts.types.lollipop",
  descriptionKey: "workspace.charts.descriptions.lollipop",
  icon: Candy,
  defaultConfig: lollipopDefaultConfig,
  defaultDataConfig: lollipopDefaultDataConfig,
  DataPanel: LollipopDataPanel,
  StylePanel: LollipopStylePanel,
  Renderer: LollipopRenderer,
  dataShelves: lollipopDataShelves,
  styleShelves: lollipopStyleShelves,
};
