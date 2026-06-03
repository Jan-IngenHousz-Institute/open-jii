import type { ComponentAlertFieldsFragment } from "../../lib/__generated/sdk";

/** Lower number sorts first: critical before warning before info. */
export const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 } as const;

export type Severity = keyof typeof SEVERITY_ORDER;

/**
 * Normalizes the free-text `severity` field from Contentful (typed as `string`
 * in the generated SDK) to a known {@link Severity}, falling back to `"info"`.
 */
export function getSeverity(alert: Pick<ComponentAlertFieldsFragment, "severity">): Severity {
  const value = alert.severity ?? "info";
  return value in SEVERITY_ORDER ? (value as Severity) : "info";
}

/** Sort rank for a severity value; unknown values sort last (as `info`). */
export function severityRank(alert: Pick<ComponentAlertFieldsFragment, "severity">): number {
  return SEVERITY_ORDER[getSeverity(alert)];
}
