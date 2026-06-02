import { Triangle } from "lucide-react";

import type { ChartTypeDef } from "../../types";
import { ternaryDefaultConfig, ternaryDefaultDataConfig } from "./defaults";
import { TernaryDataPanel } from "./panels/data-panel";
import { TernaryStylePanel } from "./panels/style-panel";
import { TernaryRenderer } from "./renderer";
import { ternaryDataShelves } from "./shelves/data-shelves";
import { ternaryStyleShelves } from "./shelves/style-shelves";

export const ternaryChartType: ChartTypeDef = {
  type: "ternary",
  family: "scientific",
  labelKey: "workspace.charts.types.ternary",
  descriptionKey: "workspace.charts.descriptions.ternary",
  icon: Triangle,
  defaultConfig: ternaryDefaultConfig,
  defaultDataConfig: ternaryDefaultDataConfig,
  DataPanel: TernaryDataPanel,
  StylePanel: TernaryStylePanel,
  Renderer: TernaryRenderer,
  dataShelves: ternaryDataShelves,
  styleShelves: ternaryStyleShelves,
};
