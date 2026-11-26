import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

import { buildCartesianTraces } from "../../../packages/ui/src/components/charts/cartesian-chart.tsx";
import { extendLayoutForFacets } from "../../../packages/ui/src/components/charts/utils.ts";
import { transformCartesianData } from "../../web/components/experiment-visualizations/charts/cartesian/cartesian-transform.ts";

// Run with: pnpm --filter @repo/e2e exec tsx scripts/check-cartesian-bar-grouping.mjs
const requireUi = createRequire(new URL("../../../packages/ui/package.json", import.meta.url));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent('<div id="chart"></div>');
  await page.addScriptTag({ path: requireUi.resolve("plotly.js/dist/plotly-basic.min.js") });

  async function render(series, range, subplots) {
    const config = { barmode: "group", bargap: 0, bargroupgap: 0 };
    let layout = {
      width: 900,
      height: 400,
      showlegend: false,
      xaxis: { type: "linear", range },
      ...config,
    };
    if (subplots) {
      layout = extendLayoutForFacets(layout, subplots.cells, subplots);
      for (const { xaxisId, yaxisId, secondaryYaxisId } of subplots.cells) {
        layout[`yaxis${secondaryYaxisId.slice(1)}`] = { anchor: xaxisId, overlaying: yaxisId };
      }
    } else {
      layout.yaxis3 = { overlaying: "y", side: "left" };
    }
    const data = buildCartesianTraces(
      series,
      "scatter",
      false,
      undefined,
      config,
      "linear",
      subplots,
    );
    return page.evaluate(
      async ({ layout, data }) => {
        const chart = document.getElementById("chart");
        const plotly = Reflect.get(window, "Plotly");
        await plotly.newPlot(chart, data, layout);
        return Array.from(chart.querySelectorAll(".barlayer .trace"), (trace) => {
          const { index, xaxis, name } = trace.__data__[0].trace;
          const axis = chart._fullLayout[`xaxis${xaxis.slice(1)}`];
          return {
            index,
            xaxis,
            name,
            bars: Array.from(trace.querySelectorAll(".point path"), (bar) => {
              const { left, right, top, bottom, width } = bar.getBoundingClientRect();
              return { left: left - axis._offset, right: right - axis._offset, width, top, bottom };
            }),
          };
        }).sort((a, b) => a.index - b.index);
      },
      { layout, data },
    );
  }

  function transform(rows, ...extraSources) {
    const sources = [
      { role: "x", columnName: "x" },
      { role: "y", columnName: "first" },
      { role: "y", columnName: "third", axis: "y3" },
      ...extraSources,
    ].map((source) => ({ ...source, tableName: "t" }));
    return transformCartesianData(
      rows,
      sources,
      {},
      {
        defaultTraceType: "bar",
        supportsContinuousColor: false,
        supportsSize: false,
      },
    );
  }

  const cases = {
    unequal: async () => {
      const groups = await render(
        [
          { traceType: "bar", x: [0, 2], y: [2, 3] },
          { traceType: "bar", x: [0, 8], y: [2, 3], axis: "y3" },
        ],
        [-2, 13],
      );
      assert.deepEqual(
        groups.map(({ bars }) => bars.length),
        [2, 2],
      );
      const [[primaryAtZero, primaryAtTwo], [axis3AtZero, axis3AtEight]] = groups.map(
        ({ bars }) => bars,
      );
      assert.ok(primaryAtZero.width > 0, JSON.stringify(groups));
      for (const bar of [primaryAtTwo, axis3AtZero, axis3AtEight]) {
        assert.ok(Math.abs(bar.width - primaryAtZero.width) <= 1, JSON.stringify(groups));
      }
      assert.ok(primaryAtZero.right <= axis3AtZero.left + 1, JSON.stringify(groups));
      assert.ok(axis3AtZero.right <= primaryAtTwo.left + 1, JSON.stringify(groups));
    },
    rounding: async () => {
      const rows = [0, 0.3, 0.30000000000000004, 1].map((x) => ({ x, first: 2, third: 3 }));
      const { chartSeries } = transform(rows);
      const groups = await render(chartSeries, [-0.2, 1.2]);
      assert.deepEqual(
        groups.map(({ bars }) => bars.length),
        [4, 4],
      );
      for (const { bars } of groups) {
        assert.ok(
          bars.every(({ width }) => width > 50),
          JSON.stringify(groups),
        );
        assert.ok(Math.abs(bars[1].left - bars[2].left) <= 1, JSON.stringify(groups));
      }

      const repeated = await render(
        chartSeries.map((series) => ({ ...series, x: [0, 0.3, 0.3, 1] })),
        [-0.2, 1.2],
      );
      for (const { bars } of repeated) {
        assert.ok(Math.abs(bars[1].top - bars[2].bottom) <= 1, JSON.stringify(repeated));
      }

      const unequalGrids = await render(
        [chartSeries[0], { ...chartSeries[1], x: [0, 0.6, 1], y: [3, 3, 3] }],
        [-0.2, 1.2],
      );
      assert.ok(
        Math.abs(unequalGrids[0].bars[0].width - unequalGrids[1].bars[0].width) <= 1,
        JSON.stringify(unequalGrids),
      );

      const distinctPerTrace = chartSeries.map((series, index) => ({
        ...series,
        x: [0, index === 0 ? 0.3 : 0.30000000000000004, 1],
        y: [2, 2, 2],
      }));
      const separate = await render(distinctPerTrace, [-0.2, 1.2]);
      assert.ok(
        separate.every(({ bars }) => bars.every(({ width }) => width > 50)),
        JSON.stringify(separate),
      );
    },
    facets: async () => {
      for (const rightMax of [2, 4]) {
        const rows = [
          ...[0, 2].flatMap((x) => ["Alpha", "Beta"].map((color) => ({ x, color, panel: "Left" }))),
          ...[0, rightMax].map((x) => ({ x, color: "Beta", panel: "Right" })),
        ].map((row) => ({ ...row, first: 2, third: 3 }));
        const { chartSeries, subplots } = transform(
          rows,
          { role: "color", columnName: "color" },
          { role: "facet", columnName: "panel" },
        );
        const groups = await render(chartSeries, [-2, 6], subplots);
        const left = groups.filter(({ xaxis, name }) => xaxis === "x" && name.endsWith("Beta"));
        const right = groups.filter(({ xaxis }) => xaxis === "x2");
        assert.equal(groups.length, 6, JSON.stringify(groups));
        assert.equal(left.length, 2, JSON.stringify(groups));
        assert.equal(right.length, 2, JSON.stringify(groups));
        for (const [index, { bars }] of left.entries()) {
          const corresponding = right[index].bars;
          assert.ok(Math.abs(bars[0].width - corresponding[0].width) <= 1, JSON.stringify(groups));
          assert.ok(Math.abs(bars[0].left - corresponding[0].left) <= 1, JSON.stringify(groups));
        }
      }
    },
    hidden: async () => {
      const rows = [
        ...[0, 10].map((x) => ({ x, color: "Sparse" })),
        ...[0, 0.001, 10].map((x) => ({ x, color: "Dense" })),
      ].map((row) => ({ ...row, first: 2, third: 3 }));
      const { chartSeries } = transform(rows, { role: "color", columnName: "color" });
      const range = [-3, 13];
      const reference = await render(
        chartSeries.map((series) => ({ ...series, x: [0, 10], y: [2, 3] })),
        range,
      );
      const hidden = await render(
        chartSeries.map((series) =>
          series.name.endsWith("Dense") ? { ...series, visible: "legendonly" } : series,
        ),
        range,
      );
      const sparse = reference.filter(({ name }) => name.endsWith("Sparse"));
      assert.deepEqual(
        hidden.map(({ index }) => index),
        sparse.map(({ index }) => index),
      );
      assert.deepEqual(
        hidden.map(({ bars }) => bars.length),
        [2, 2],
      );
      for (const [index, { bars }] of sparse.entries()) {
        for (const [point, expected] of bars.entries()) {
          const actual = hidden[index].bars[point];
          assert.ok(
            Math.abs(actual.width - expected.width) <= 1,
            JSON.stringify({ hidden, sparse }),
          );
          assert.ok(Math.abs(actual.left - expected.left) <= 1, JSON.stringify({ hidden, sparse }));
        }
      }
    },
  };
  for (const [name, check] of Object.entries(cases)) {
    if (process.argv[2] && process.argv[2] !== name) continue;
    await check();
    console.log(`Grouped bar bounds passed: ${name}.`);
  }
} finally {
  await browser.close();
}
