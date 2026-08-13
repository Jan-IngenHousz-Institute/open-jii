/**
 * Experiment-series colors for the monitoring charts: a CVD-validated subset
 * of the house CATEGORY_PALETTE, assigned in fixed order. Experiments beyond
 * the palette fold into "Other" rather than cycling hues.
 */
export const MONITORING_SERIES_COLORS = ["#1f77b4", "#ff7f0e", "#9467bd", "#17becf"] as const;

export const MONITORING_MAX_SERIES = MONITORING_SERIES_COLORS.length;

export const MONITORING_PRIMARY_COLOR = MONITORING_SERIES_COLORS[0];
