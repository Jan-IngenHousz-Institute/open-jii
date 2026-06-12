import { CircleDot } from "lucide-react";

import type { ChartTypeDef } from "../../types";
import { bubbleDefaultConfig, bubbleDefaultDataConfig } from "./defaults";
import { BubbleDataPanel } from "./panels/data-panel";
import { BubbleStylePanel } from "./panels/style-panel";
import { BubbleRenderer } from "./renderer";
import { bubbleDataShelves } from "./shelves/data-shelves";
import { bubbleStyleShelves } from "./shelves/style-shelves";

export const bubbleChartType: ChartTypeDef = {
  type: "bubble",
  family: "basic",
  labelKey: "workspace.charts.types.bubble",
  descriptionKey: "workspace.charts.descriptions.bubble",
  icon: CircleDot,
  defaultConfig: bubbleDefaultConfig,
  defaultDataConfig: bubbleDefaultDataConfig,
  DataPanel: BubbleDataPanel,
  StylePanel: BubbleStylePanel,
  Renderer: BubbleRenderer,
  dataShelves: bubbleDataShelves,
  styleShelves: bubbleStyleShelves,
};
