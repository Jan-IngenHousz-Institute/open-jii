/** Registered with the runtime itself: what every sparkline draws. Scatter ships with core. */
export const EAGER_TRACE_TYPES = ["scatter", "bar"] as const;

/** Registered on first use, each family from its own chunk. */
export const LAZY_TRACE_TYPES = [
  "barpolar",
  "box",
  "carpet",
  "contour",
  "contourcarpet",
  "heatmap",
  "histogram",
  "histogram2d",
  "histogram2dcontour",
  "parcats",
  "parcoords",
  "pie",
  "sankey",
  "scattercarpet",
  "scattergl",
  "scatterpolar",
  "scatterternary",
  "violin",
] as const;

export type EagerTraceType = (typeof EAGER_TRACE_TYPES)[number];

export type LazyTraceType = (typeof LAZY_TRACE_TYPES)[number];

export type LoadableTraceType = EagerTraceType | LazyTraceType;

export const isEagerTraceType = (type: string): type is EagerTraceType =>
  EAGER_TRACE_TYPES.some((candidate) => candidate === type);

export const isLazyTraceType = (type: string): type is LazyTraceType =>
  LAZY_TRACE_TYPES.some((candidate) => candidate === type);
