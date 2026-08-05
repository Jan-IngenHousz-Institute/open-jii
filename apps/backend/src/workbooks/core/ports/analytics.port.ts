import type { FeatureFlagKey } from "@repo/analytics";

export const WORKBOOK_ANALYTICS_PORT = Symbol("WORKBOOK_ANALYTICS_PORT");

export interface WorkbookAnalyticsPort {
  isFeatureFlagEnabled(flagKey: FeatureFlagKey, distinctId?: string): Promise<boolean>;
}
