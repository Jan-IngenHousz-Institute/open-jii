import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

import { buildCartesianTraces } from "../../../packages/ui/src/components/charts/cartesian-chart.tsx";

// Run with: pnpm --filter @repo/e2e exec tsx scripts/check-cartesian-bar-grouping.mjs
const requireUi = createRequire(new URL("../../../packages/ui/package.json", import.meta.url));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent('<div id="chart"></div>');
  await page.addScriptTag({ path: requireUi.resolve("plotly.js/dist/plotly-basic.min.js") });

  const layout = {
    width: 800,
    height: 400,
    xaxis: { range: [-2, 13] },
    yaxis3: { overlaying: "y", side: "left" },
    barmode: "group",
    bargap: 0,
    bargroupgap: 0,
  };
  const data = buildCartesianTraces(
    [
      { traceType: "bar", x: [0, 2], y: [2, 3] },
      { traceType: "bar", x: [0, 8], y: [2, 3], axis: "y3" },
    ],
    "scatter",
    false,
    undefined,
    layout,
    "linear",
  );
  const { version, bounds } = await page.evaluate(
    async ({ layout, data }) => {
      const chart = document.getElementById("chart");
      const plotly = Reflect.get(window, "Plotly");
      await plotly.newPlot(chart, data, layout);
      return {
        version: plotly.version,
        bounds: Array.from(chart.querySelectorAll(".barlayer .trace"), (trace) =>
          Array.from(trace.querySelectorAll(".point path"), (bar) => {
            const { left, right, width } = bar.getBoundingClientRect();
            return { left, right, width };
          }),
        ),
      };
    },
    { layout, data },
  );

  assert.deepEqual(
    bounds.map((trace) => trace.length),
    [2, 2],
  );
  const [[primaryAtZero, primaryAtTwo], [axis3AtZero, axis3AtEight]] = bounds;
  assert.ok(primaryAtZero.width > 0, JSON.stringify(bounds));
  for (const bar of [primaryAtTwo, axis3AtZero, axis3AtEight]) {
    assert.ok(Math.abs(bar.width - primaryAtZero.width) <= 1, JSON.stringify({ version, bounds }));
  }
  assert.ok(primaryAtZero.right <= axis3AtZero.left + 1, JSON.stringify(bounds));
  assert.ok(axis3AtZero.right <= primaryAtTwo.left + 1, JSON.stringify(bounds));
  console.log(`Plotly ${version}: grouped bars render with equal widths and without overlap.`);
} finally {
  await browser.close();
}
