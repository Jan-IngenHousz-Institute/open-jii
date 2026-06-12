import { Grid3x3 } from "lucide-react";

import type { ChartTypeDef } from "../../types";
import { carpetDefaultConfig, carpetDefaultDataConfig } from "./defaults";
import { CarpetDataPanel } from "./panels/data-panel";
import { CarpetStylePanel } from "./panels/style-panel";
import { CarpetRenderer } from "./renderer";
import { carpetDataShelves } from "./shelves/data-shelves";
import { carpetStyleShelves } from "./shelves/style-shelves";

export const carpetChartType: ChartTypeDef = {
  type: "carpet",
  family: "scientific",
  labelKey: "workspace.charts.types.carpet",
  descriptionKey: "workspace.charts.descriptions.carpet",
  icon: Grid3x3,
  defaultConfig: carpetDefaultConfig,
  defaultDataConfig: carpetDefaultDataConfig,
  DataPanel: CarpetDataPanel,
  StylePanel: CarpetStylePanel,
  Renderer: CarpetRenderer,
  dataShelves: carpetDataShelves,
  styleShelves: carpetStyleShelves,
};
