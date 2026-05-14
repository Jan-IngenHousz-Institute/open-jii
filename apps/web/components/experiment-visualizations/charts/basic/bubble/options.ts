/**
 * Bubble sizing options. The renderer computes Plotly's `sizeref` from
 * `bubbleMaxSize` and the actual data so users think in pixels, not sizeref.
 */
export interface BubbleChartOptions {
  sizemode?: "diameter" | "area";
  bubbleMaxSize?: number;
  bubbleMinSize?: number;
}
