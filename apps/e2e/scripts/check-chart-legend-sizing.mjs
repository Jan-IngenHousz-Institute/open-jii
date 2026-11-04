import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

import {
  withBoundedRightLegend,
  withOuterLabels,
} from "../../../packages/ui/src/components/charts/outer-labels.ts";
import { createBaseLayout } from "../../../packages/ui/src/components/charts/utils.ts";

// Run with: pnpm --filter @repo/e2e exec tsx scripts/check-chart-legend-sizing.mjs
// No backend, authentication, warehouse or WebGL is needed for this regression.
const requireUi = createRequire(new URL("../../../packages/ui/package.json", import.meta.url));
const browser = await chromium.launch({ headless: true });
let checked = 0;
try {
  const page = await browser.newPage();
  await page.setContent('<div id="chart"></div>');
  await page.addScriptTag({ path: requireUi.resolve("plotly.js/dist/plotly.min.js") });

  for (const width of [240, 280, 480, 720, 1000]) {
    for (const length of [40, 120, 400]) {
      for (const family of ["cartesian", "secondary", "colorbar", "pie"]) {
        const config = { width, height: 300, legendPosition: "right" };
        const sizing = {
          snug: width < 720,
          compact: width < 480,
          veryCompact: width < 280,
          hasColorbar: family === "colorbar",
          hasSecondaryAxis: family === "secondary",
        };
        const name = "W".repeat(length);
        const data =
          family === "pie"
            ? [
                {
                  type: "pie",
                  labels: [name, "Other"],
                  values: [2, 1],
                  textinfo: "percent",
                  textposition: "inside",
                },
              ]
            : [{ type: "scatter", x: [1, 2], y: [1, 2], name }];
        let layout = createBaseLayout(config, sizing);
        if (family === "secondary") {
          data.push({
            type: "scatter",
            x: [1, 2],
            y: [3, 4],
            name: "Other",
            yaxis: "y2",
          });
          layout = {
            ...layout,
            yaxis2: {
              overlaying: "y",
              side: "right",
              automargin: true,
              title: { text: "Secondary axis" },
            },
          };
        }
        if (family === "colorbar") {
          if (data[0])
            data[0].marker = {
              color: [1, 2],
              showscale: true,
              colorbar: { title: { text: "Colour scale" } },
            };
        }
        const bounded = withBoundedRightLegend(layout, config, data, width);
        const result = await page.evaluate(
          async ({ layout, data, family }) => {
            const node = document.getElementById("chart");
            if (!node) throw new Error("Missing chart container");
            const plotly = Reflect.get(window, "Plotly");
            let error;
            try {
              await plotly.newPlot(node, data, layout);
            } catch (cause) {
              error = String(cause);
            }
            const fullLayout = Reflect.get(node, "_fullLayout");
            const result = {
              error,
              width: fullLayout?._size?.w ?? 0,
              height: fullLayout?._size?.h ?? 0,
              marks: node.querySelectorAll(family === "pie" ? ".slice" : ".js-line, .point").length,
            };
            plotly.purge(node);
            return result;
          },
          { ...bounded, family },
        );
        const label = `${family}, ${width}px, ${length} characters`;
        assert.equal(result.error, undefined, `${label}: axis scaling must not throw`);
        assert.ok(
          result.width > 0 && result.height > 0,
          `${label}: plot dimensions must stay positive`,
        );
        assert.ok(result.marks > 0, `${label}: data must remain visible`);
        checked++;
      }
    }
  }
  for (const width of [280, 480, 1000]) {
    for (const legendPosition of ["left", "right", "top", "bottom"]) {
      for (const family of ["polar", "radar", "wind-rose", "ternary"]) {
        const config = { width, height: 300, title: family, legendPosition };
        const sizing = { width, snug: width < 720, compact: width < 480 };
        const name = "Long scientific series name ".repeat(5);
        const trace =
          family === "ternary"
            ? {
                type: "scatterternary",
                a: [0.2, 0.4],
                b: [0.3, 0.3],
                c: [0.5, 0.3],
                mode: "markers",
                name,
              }
            : {
                type: family === "wind-rose" ? "barpolar" : "scatterpolar",
                r: [1, 2, 3],
                theta: [0, 120, 240],
                mode: "lines+markers",
                name,
              };
        const figure = withOuterLabels({
          config,
          sizing,
          labels: { left: 40, right: 40, top: 32, bottom: 32 },
          traces: [trace],
          ...(family === "wind-rose" ? { radialTitle: { text: "Frequency", fontSize: 12 } } : {}),
        });
        const result = await page.evaluate(async ({ layout, data }) => {
          const node = document.getElementById("chart");
          if (!node) throw new Error("Missing chart container");
          const plotly = Reflect.get(window, "Plotly");
          let error;
          try {
            await plotly.newPlot(node, data, layout);
          } catch (cause) {
            error = String(cause);
          }
          const size = Reflect.get(node, "_fullLayout")?._size;
          const result = {
            error,
            width: size?.w ?? 0,
            height: size?.h ?? 0,
            marks: node.querySelectorAll(".point, .js-line").length,
          };
          plotly.purge(node);
          return result;
        }, figure);
        const label = `${family}, ${legendPosition}, ${width}px`;
        assert.equal(result.error, undefined, `${label}: outer labels must render`);
        assert.ok(
          result.width > 0 && result.height > 0,
          `${label}: plot dimensions must stay positive`,
        );
        assert.ok(result.marks > 0, `${label}: data must remain visible`);
        checked++;
      }
    }
  }
  console.log(`${checked} real-Plotly long-legend renders passed.`);
} finally {
  await browser.close();
}
