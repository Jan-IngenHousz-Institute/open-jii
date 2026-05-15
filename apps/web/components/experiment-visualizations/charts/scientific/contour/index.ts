import { Map } from "lucide-react";

import type { ChartTypeDef } from "../../types";
import { contourDefaultConfig, contourDefaultDataConfig } from "./defaults";
import { ContourDataPanel } from "./panels/data-panel";
import { ContourStylePanel } from "./panels/style-panel";
import { ContourRenderer } from "./renderer";
import { contourDataShelves } from "./shelves/data-shelves";
import { contourStyleShelves } from "./shelves/style-shelves";

export const contourChartType: ChartTypeDef = {
  type: "contour",
  family: "scientific",
  labelKey: "workspace.charts.types.contour",
  descriptionKey: "workspace.charts.descriptions.contour",
  icon: Map,
  defaultConfig: contourDefaultConfig,
  defaultDataConfig: contourDefaultDataConfig,
  DataPanel: ContourDataPanel,
  StylePanel: ContourStylePanel,
  Renderer: ContourRenderer,
  dataShelves: contourDataShelves,
  styleShelves: contourStyleShelves,
};
