/**
 * Alluvial-only options. Row counts per (stage_i, stage_{i+1}) pair size each
 * link; optional numeric `value` column sums instead. Counting is the chart's
 * purpose, so there's no `aggregate` dropdown on the data shelf.
 */
export interface AlluvialChartOptions {
  alluvialNodeThickness?: number;
  alluvialNodePadding?: number;
  alluvialLinkOpacity?: number;
  alluvialColorMode?: "stage" | "value";
  alluvialHideLabels?: boolean;
}
