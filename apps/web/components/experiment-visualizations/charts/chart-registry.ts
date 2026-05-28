import type { ChartFamily, ChartType } from "@repo/api/schemas/experiment.schema";

import { areaChartType } from "./basic/area";
import { barChartType } from "./basic/bar";
import { bubbleChartType } from "./basic/bubble";
import { dotPlotChartType } from "./basic/dot-plot";
import { lineChartType } from "./basic/line";
import { lollipopChartType } from "./basic/lollipop";
import { pieChartType } from "./basic/pie";
import { scatterChartType } from "./basic/scatter";
import type { ChartTypeDef } from "./types";

const REGISTRY: Partial<Record<ChartType, ChartTypeDef>> = {
  line: lineChartType,
  scatter: scatterChartType,
  bar: barChartType,
  area: areaChartType,
  "dot-plot": dotPlotChartType,
  lollipop: lollipopChartType,
  bubble: bubbleChartType,
  pie: pieChartType,
};

export function getChartTypeDef(type: ChartType): ChartTypeDef | undefined {
  return REGISTRY[type];
}

export function listChartTypes(): ChartTypeDef[] {
  return Object.values(REGISTRY).filter((d): d is ChartTypeDef => Boolean(d));
}

export function listChartTypesByFamily(): Record<ChartFamily, ChartTypeDef[]> {
  const grouped: Record<ChartFamily, ChartTypeDef[]> = {
    basic: [],
    scientific: [],
    "3d": [],
    statistical: [],
  };
  for (const def of listChartTypes()) {
    grouped[def.family].push(def);
  }
  return grouped;
}

export function isSupportedChartType(type: ChartType): boolean {
  return Boolean(REGISTRY[type]);
}
