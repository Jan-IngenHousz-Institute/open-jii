import { Activity } from "lucide-react";

import type { ChartTypeDef } from "../../types";
import { spcDefaultConfig, spcDefaultDataConfig } from "./defaults";
import { SPCDataPanel } from "./panels/data-panel";
import { SPCStylePanel } from "./panels/style-panel";
import { SPCRenderer } from "./renderer";
import { spcControlChartDataShelves } from "./shelves/data-shelves";
import { spcControlChartStyleShelves } from "./shelves/style-shelves";

export const spcControlChartType: ChartTypeDef = {
  type: "spc-control-chart",
  family: "statistical",
  labelKey: "workspace.charts.types.spcControlChart",
  descriptionKey: "workspace.charts.descriptions.spcControlChart",
  icon: Activity,
  defaultConfig: spcDefaultConfig,
  defaultDataConfig: spcDefaultDataConfig,
  DataPanel: SPCDataPanel,
  StylePanel: SPCStylePanel,
  Renderer: SPCRenderer,
  dataShelves: spcControlChartDataShelves,
  styleShelves: spcControlChartStyleShelves,
};
