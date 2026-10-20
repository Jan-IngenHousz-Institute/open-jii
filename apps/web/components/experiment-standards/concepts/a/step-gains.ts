import type {
  ReadinessReason,
  StandardFields,
  StandardId,
  StandardReadiness,
} from "@repo/api/domains/experiment/standards/experiment-standards.schema";

import type { ReadinessStep } from "../readiness-steps";

export interface StandardGain {
  standard: StandardId;
  /** The standard's fields the step fills. A score such as FAIR has none. */
  fields: number;
}

function reasonFields(reason: ReadinessReason): number {
  const isCounted = reason.code === "columns-without-term" || reason.code === "fields-from-dataset";
  return isCounted ? reason.count : 0;
}

/**
 * Splits a step's field count across the standards it moves, since each chip names one of them.
 * The chip that gains most comes first.
 */
export function stepGains(
  step: ReadinessStep,
  readiness: StandardReadiness[],
  miappe: StandardFields,
): StandardGain[] {
  const miappeFields = miappe.fields.filter(
    (field) => field.status === "missing" && field.fix === step.action,
  ).length;

  const toGain = (row: StandardReadiness): StandardGain => ({
    standard: row.standard,
    fields: row.standard === "miappe" ? miappeFields : reasonFields(row.reason),
  });

  return readiness
    .filter((row) => step.standards.includes(row.standard))
    .map(toGain)
    .sort((a, b) => b.fields - a.fields);
}
