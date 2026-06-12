import { AlignVerticalJustifyCenter } from "lucide-react";

import type { ChartTypeDef } from "../../types";
import { parallelCoordinatesDefaultConfig, parallelCoordinatesDefaultDataConfig } from "./defaults";
import { ParallelCoordinatesDataPanel } from "./panels/data-panel";
import { ParallelCoordinatesStylePanel } from "./panels/style-panel";
import { ParallelCoordinatesRenderer } from "./renderer";
import { parallelCoordinatesDataShelves } from "./shelves/data-shelves";
import { parallelCoordinatesStyleShelves } from "./shelves/style-shelves";

export const parallelCoordinatesChartType: ChartTypeDef = {
  type: "parallel-coordinates",
  family: "scientific",
  labelKey: "workspace.charts.types.parallelCoordinates",
  descriptionKey: "workspace.charts.descriptions.parallelCoordinates",
  icon: AlignVerticalJustifyCenter,
  defaultConfig: parallelCoordinatesDefaultConfig,
  defaultDataConfig: parallelCoordinatesDefaultDataConfig,
  DataPanel: ParallelCoordinatesDataPanel,
  StylePanel: ParallelCoordinatesStylePanel,
  Renderer: ParallelCoordinatesRenderer,
  dataShelves: parallelCoordinatesDataShelves,
  styleShelves: parallelCoordinatesStyleShelves,
};
