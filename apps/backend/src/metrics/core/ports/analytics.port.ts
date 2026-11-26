import type { FeatureFlagKey } from "@repo/analytics";

export const ANALYTICS_PORT = Symbol("METRICS_ANALYTICS_PORT");

/** Feature flags for the metrics reads, which no user makes. */
export interface AnalyticsPort {
  /** After the first answer, the last one while a lapsed one refreshes, so a read does not wait. */
  isEnvironmentFeatureFlagEnabled(flagKey: FeatureFlagKey): Promise<boolean>;
}
