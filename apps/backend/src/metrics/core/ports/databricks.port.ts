import type { Result } from "../../../common/utils/fp-utils";
import type {
  ActivityWindowsRow,
  ContributorPairRow,
  DailyActivityRow,
  FamilyTotalsRow,
  HourlyActivityRow,
  ParameterStatsRow,
  PlatformTotalsRow,
  PoolFactsRow,
  ScopedDailyRow,
} from "../models/public-metrics.model";

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
  getTopParameter(): Promise<Result<ParameterStatsRow | null>>;
  getPoolFacts(): Promise<Result<PoolFactsRow | null>>;
  getScopedDailyActivity(days: number): Promise<Result<ScopedDailyRow[]>>;
  getContributorPairs(): Promise<Result<ContributorPairRow[]>>;
}
