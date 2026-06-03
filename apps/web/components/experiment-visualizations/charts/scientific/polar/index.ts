import { Compass } from "lucide-react";

import type { ChartTypeDef } from "../../types";
import { polarDefaultConfig, polarDefaultDataConfig } from "./defaults";
import { PolarDataPanel } from "./panels/data-panel";
import { PolarStylePanel } from "./panels/style-panel";
import { PolarRenderer } from "./renderer";
import { polarDataShelves } from "./shelves/data-shelves";
import { polarStyleShelves } from "./shelves/style-shelves";

export const polarChartType: ChartTypeDef = {
  type: "polar",
  family: "scientific",
  labelKey: "workspace.charts.types.polar",
  descriptionKey: "workspace.charts.descriptions.polar",
  icon: Compass,
  defaultConfig: polarDefaultConfig,
  defaultDataConfig: polarDefaultDataConfig,
  DataPanel: PolarDataPanel,
  StylePanel: PolarStylePanel,
  Renderer: PolarRenderer,
  dataShelves: polarDataShelves,
  styleShelves: polarStyleShelves,
};
