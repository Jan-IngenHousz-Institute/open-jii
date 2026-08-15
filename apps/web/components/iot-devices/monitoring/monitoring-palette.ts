import { CATEGORY_PALETTE } from "@/components/experiment-visualizations/charts/colors/palettes";

// The house categorical palette, reordered for this dashboard: its first four
// entries put #ff7f0e next to #2ca02c, a pair that collapses under protanopia
// (ΔE well under the readable floor). These four indices keep the same hues but
// stay separable, and series past them fold into "Other" rather than cycling.
const CVD_SAFE_ORDER = [0, 1, 4, 9] as const;

export const MONITORING_SERIES_COLORS = CVD_SAFE_ORDER.map((index) => CATEGORY_PALETTE[index]);

export const MONITORING_MAX_SERIES = MONITORING_SERIES_COLORS.length;

export const MONITORING_PRIMARY_COLOR = MONITORING_SERIES_COLORS[0];
