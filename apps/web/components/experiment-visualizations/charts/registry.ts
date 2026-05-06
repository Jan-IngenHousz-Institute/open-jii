import type { ChartFamily, ChartType } from "@repo/api/schemas/experiment.schema";

import { lineChartType } from "./line";
import { scatterChartType } from "./scatter";
import type { ChartTypeDef } from "./types";

const REGISTRY: Partial<Record<ChartType, ChartTypeDef>> = {
  line: lineChartType,
  scatter: scatterChartType,
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
