import type { Result } from "../../../common/utils/fp-utils";

export interface PlatformTotalsRow {
  totalMeasurements: number;
  totalVolumeBytes: number;
  totalUploadedRows: number;
  totalMacroExecutions: number;
  devicesAllTime: number;
  experimentsWithData: number;
  firstMeasurementAt: string | null;
  lastMeasurementAt: string | null;
  computedAt: string | null;
}

export interface DailyActivityRow {
  date: string;
  measurements: number;
  cumulativeMeasurements: number;
  volumeBytes: number;
}

export interface HourlyActivityRow {
  hourLocal: number;
  measurements: number;
}

export interface FamilyTotalsRow {
  family: string;
  measurements: number;
}

export interface ActivityWindowsRow {
  measurements24h: number;
  measurements30d: number;
  experiments30d: number;
  contributors30d: number;
  devices30d: number;
  lastMeasurementAt: string | null;
  computedAt: string | null;
}

export type ParameterCategory = "derived" | "sensor";

export interface ParameterStatsRow {
  name: string;
  count30d: number;
  median: number;
}

export interface PoolFactsRow {
  sessionMedianMeasurements: number | null;
  meanArrivalGapSeconds: number | null;
  currentStreakDays: number | null;
  deviceEnduranceDays: number | null;
  simultaneityPeakDevices: number | null;
  timezonesAllTime: number | null;
  timezonesPeakDay: number | null;
}

export interface ScopedDailyRow {
  date: string;
  experimentId: string;
  measurements: number;
}

export interface ContributorPairRow {
  experimentId: string;
  userId: string;
}

/**
 * Injection token for the metrics Databricks port
 */
export const METRICS_DATABRICKS_PORT = Symbol("METRICS_DATABRICKS_PORT");

/**
 * Port interface for reading the pre-aggregated metrics tables from the
 * warehouse. The scoped rows (per-experiment, per-contributor) are
 * backend-only inputs and must never reach a response unaggregated.
 */
export interface DatabricksPort {
  getPublicPlatformTotals(): Promise<Result<PlatformTotalsRow | null>>;
  getPublicDailyActivity(days: number): Promise<Result<DailyActivityRow[]>>;
  getPublicFamilyTotals(): Promise<Result<FamilyTotalsRow[]>>;
  getActivityWindows(): Promise<Result<ActivityWindowsRow | null>>;
  getHourlyActivity(): Promise<Result<HourlyActivityRow[]>>;
  getTopParameter(category: ParameterCategory): Promise<Result<ParameterStatsRow | null>>;
  getPoolFacts(): Promise<Result<PoolFactsRow | null>>;
  getScopedDailyActivity(days: number): Promise<Result<ScopedDailyRow[]>>;
  getContributorPairs(): Promise<Result<ContributorPairRow[]>>;
}
