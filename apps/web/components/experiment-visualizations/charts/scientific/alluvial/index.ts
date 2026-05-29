import { Waves } from "lucide-react";

import type { ChartTypeDef } from "../../types";
import { alluvialDefaultConfig, alluvialDefaultDataConfig } from "./defaults";
import { AlluvialDataPanel } from "./panels/data-panel";
import { AlluvialStylePanel } from "./panels/style-panel";
import { AlluvialRenderer } from "./renderer";
import { alluvialDataShelves } from "./shelves/data-shelves";
import { alluvialStyleShelves } from "./shelves/style-shelves";

export const alluvialChartType: ChartTypeDef = {
  type: "alluvial",
  family: "scientific",
  labelKey: "workspace.charts.types.alluvial",
  descriptionKey: "workspace.charts.descriptions.alluvial",
  icon: Waves,
  defaultConfig: alluvialDefaultConfig,
  defaultDataConfig: alluvialDefaultDataConfig,
  DataPanel: AlluvialDataPanel,
  StylePanel: AlluvialStylePanel,
  Renderer: AlluvialRenderer,
  dataShelves: alluvialDataShelves,
  styleShelves: alluvialStyleShelves,
};
