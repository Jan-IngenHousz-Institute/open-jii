import { Wind } from "lucide-react";

import type { ChartTypeDef } from "../../types";
import { windRoseDefaultConfig, windRoseDefaultDataConfig } from "./defaults";
import { WindRoseDataPanel } from "./panels/data-panel";
import { WindRoseStylePanel } from "./panels/style-panel";
import { WindRoseRenderer } from "./renderer";
import { windRoseDataShelves } from "./shelves/data-shelves";
import { windRoseStyleShelves } from "./shelves/style-shelves";

export const windRoseChartType: ChartTypeDef = {
  type: "wind-rose",
  family: "scientific",
  labelKey: "workspace.charts.types.windRose",
  descriptionKey: "workspace.charts.descriptions.windRose",
  icon: Wind,
  defaultConfig: windRoseDefaultConfig,
  defaultDataConfig: windRoseDefaultDataConfig,
  DataPanel: WindRoseDataPanel,
  StylePanel: WindRoseStylePanel,
  Renderer: WindRoseRenderer,
  dataShelves: windRoseDataShelves,
  styleShelves: windRoseStyleShelves,
};
