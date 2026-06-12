import { Table } from "lucide-react";

import type { ChartTypeDef } from "../../types";
import { correlationMatrixDefaultConfig, correlationMatrixDefaultDataConfig } from "./defaults";
import { CorrelationMatrixDataPanel } from "./panels/data-panel";
import { CorrelationMatrixStylePanel } from "./panels/style-panel";
import { CorrelationMatrixRenderer } from "./renderer";
import { correlationMatrixDataShelves } from "./shelves/data-shelves";
import { correlationMatrixStyleShelves } from "./shelves/style-shelves";

export const correlationMatrixChartType: ChartTypeDef = {
  type: "correlation-matrix",
  family: "scientific",
  labelKey: "workspace.charts.types.correlationMatrix",
  descriptionKey: "workspace.charts.descriptions.correlationMatrix",
  icon: Table,
  defaultConfig: correlationMatrixDefaultConfig,
  defaultDataConfig: correlationMatrixDefaultDataConfig,
  DataPanel: CorrelationMatrixDataPanel,
  StylePanel: CorrelationMatrixStylePanel,
  Renderer: CorrelationMatrixRenderer,
  dataShelves: correlationMatrixDataShelves,
  styleShelves: correlationMatrixStyleShelves,
};
