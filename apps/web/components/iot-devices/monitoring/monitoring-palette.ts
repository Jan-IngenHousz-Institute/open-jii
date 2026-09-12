import { resolveChartColorway } from "@repo/ui/components/charts/utils";

/** The colorway's first four, already widest-separation-first. Past four folds into "Other". */
export const MONITORING_MAX_SERIES = 4;

export function monitoringSeriesColors(): string[] {
  return resolveChartColorway().slice(0, MONITORING_MAX_SERIES);
}

export function monitoringPrimaryColor(): string {
  return monitoringSeriesColors()[0] ?? "#005E5E";
}
