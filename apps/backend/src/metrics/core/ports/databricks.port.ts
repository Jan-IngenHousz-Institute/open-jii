import type {
  PublicDailyActivity,
  PublicFamilyTotals,
  PublicPlatformTotals,
} from "@repo/api/domains/metrics/metrics.schema";

import type { Result } from "../../../common/utils/fp-utils";

/**
 * Injection token for the metrics Databricks port
 */
export const METRICS_DATABRICKS_PORT = Symbol("METRICS_DATABRICKS_PORT");

/**
 * Port interface for reading the pre-aggregated public metrics tables from
 * the warehouse. Timestamps are passed through as warehouse text; nothing
 * here touches raw research data.
 */
export interface MetricsDatabricksPort {
  getPublicPlatformTotals(): Promise<Result<PublicPlatformTotals | null>>;
  getPublicDailyActivity(days: number): Promise<Result<PublicDailyActivity[]>>;
  getPublicFamilyTotals(): Promise<Result<PublicFamilyTotals[]>>;
}
