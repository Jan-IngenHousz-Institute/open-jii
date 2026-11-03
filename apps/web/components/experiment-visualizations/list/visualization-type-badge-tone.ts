import type { StatusTone } from "@/components/shared/status-badge";

import type {
  ExperimentChartFamily,
  ExperimentChartType,
} from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";

import { getChartTypeDef } from "../charts/chart-registry";

// Type-pill tone keyed off chart family so the list scales without per-type
// bookkeeping. Unsupported types fall through to the neutral tone.
const FAMILY_BADGE_TONE: Record<ExperimentChartFamily, StatusTone> = {
  basic: "published",
  statistical: "stale",
  scientific: "archived",
  "3d": "archived",
};

/** The tone of a chart's type pill in the charts list. */
export function visualizationTypeBadgeTone(chartType: ExperimentChartType): StatusTone {
  return FAMILY_BADGE_TONE[getChartTypeDef(chartType).family];
}
