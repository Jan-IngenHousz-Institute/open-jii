import * as bar from "plotly.js/lib/bar";
import * as barpolar from "plotly.js/lib/barpolar";
import * as box from "plotly.js/lib/box";
import * as carpet from "plotly.js/lib/carpet";
import * as contour from "plotly.js/lib/contour";
import * as contourcarpet from "plotly.js/lib/contourcarpet";
import * as Plotly from "plotly.js/lib/core";
import * as heatmap from "plotly.js/lib/heatmap";
import * as histogram from "plotly.js/lib/histogram";
import * as histogram2d from "plotly.js/lib/histogram2d";
import * as histogram2dcontour from "plotly.js/lib/histogram2dcontour";
import * as parcats from "plotly.js/lib/parcats";
import * as parcoords from "plotly.js/lib/parcoords";
import * as pie from "plotly.js/lib/pie";
import * as sankey from "plotly.js/lib/sankey";
import * as scattercarpet from "plotly.js/lib/scattercarpet";
import * as scattergl from "plotly.js/lib/scattergl";
import * as scatterpolar from "plotly.js/lib/scatterpolar";
import * as scatterternary from "plotly.js/lib/scatterternary";
import * as violin from "plotly.js/lib/violin";
import createPlotlyComponent from "react-plotly.js/factory";

/**
 * Plotly core plus only the trace families the chart wrappers emit; scatter
 * ships with core. Loaded lazily by the chart, never at page load.
 */
Plotly.register([
  bar,
  barpolar,
  box,
  carpet,
  contour,
  contourcarpet,
  heatmap,
  histogram,
  histogram2d,
  histogram2dcontour,
  parcats,
  parcoords,
  pie,
  sankey,
  scattercarpet,
  scattergl,
  scatterpolar,
  scatterternary,
  violin,
]);

export const Plot = createPlotlyComponent(Plotly);

export { Plotly };
