import * as bar from "plotly.js/lib/bar";
import * as Plotly from "plotly.js/lib/core";
import createPlotlyComponent from "react-plotly.js/factory";

import type { LazyTraceType } from "./plotly-trace-types";

type TraceModules = Extract<Parameters<typeof Plotly.register>[0], unknown[]>;

/**
 * Plotly core plus bar, which is what every sparkline draws, so a dashboard of
 * strips needs one request. Scatter ships with core. The other families load
 * on first use through `registerTraceTypes`.
 */
Plotly.register([bar]);

const loadCarpet = () => import("plotly.js/lib/carpet");

// The imports sit beside core so the bundler leaves core's modules out of each
// family's chunk instead of copying them in.
const TRACE_LOADERS = {
  barpolar: () => Promise.all([import("plotly.js/lib/barpolar")]),
  box: () => Promise.all([import("plotly.js/lib/box")]),
  carpet: () => Promise.all([loadCarpet()]),
  contour: () => Promise.all([import("plotly.js/lib/contour")]),
  // Drawn on a carpet trace's axes, which only exist once carpet is registered.
  contourcarpet: () => Promise.all([loadCarpet(), import("plotly.js/lib/contourcarpet")]),
  heatmap: () => Promise.all([import("plotly.js/lib/heatmap")]),
  histogram: () => Promise.all([import("plotly.js/lib/histogram")]),
  histogram2d: () => Promise.all([import("plotly.js/lib/histogram2d")]),
  histogram2dcontour: () => Promise.all([import("plotly.js/lib/histogram2dcontour")]),
  parcats: () => Promise.all([import("plotly.js/lib/parcats")]),
  parcoords: () => Promise.all([import("plotly.js/lib/parcoords")]),
  pie: () => Promise.all([import("plotly.js/lib/pie")]),
  sankey: () => Promise.all([import("plotly.js/lib/sankey")]),
  scattercarpet: () => Promise.all([loadCarpet(), import("plotly.js/lib/scattercarpet")]),
  scattergl: () => Promise.all([import("plotly.js/lib/scattergl")]),
  scatterpolar: () => Promise.all([import("plotly.js/lib/scatterpolar")]),
  scatterternary: () => Promise.all([import("plotly.js/lib/scatterternary")]),
  violin: () => Promise.all([import("plotly.js/lib/violin")]),
} satisfies Record<LazyTraceType, () => Promise<TraceModules>>;

/** Registers the families behind `types`. Plotly ignores a family it already has. */
export async function registerTraceTypes(types: readonly LazyTraceType[]): Promise<void> {
  const families = await Promise.all(types.map((type) => TRACE_LOADERS[type]()));
  Plotly.register(families.flat());
}

export const Plot = createPlotlyComponent(Plotly);

export { Plotly };
