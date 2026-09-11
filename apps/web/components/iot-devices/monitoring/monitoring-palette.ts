import { resolveChartColorway } from "@repo/ui/components/charts/utils";

/**
 * The first four platform series colours. The shared colorway is already
 * ordered widest-separation-first, so the top of it is what this dashboard
 * used to hand-pick indices for; series past four fold into "Other" rather
 * than cycling.
 */
export const MONITORING_MAX_SERIES = 4;

export function monitoringSeriesColors(): string[] {
  return resolveChartColorway().slice(0, MONITORING_MAX_SERIES);
}

export function monitoringPrimaryColor(): string {
  return monitoringSeriesColors()[0] ?? "#005E5E";
}
