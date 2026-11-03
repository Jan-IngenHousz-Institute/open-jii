import type { ExperimentDataFilterValue } from "@repo/api/domains/experiment/data/experiment-data.schema";

export function scalarFilterDisplay(value: ExperimentDataFilterValue): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return "";
  return String(value);
}
