import { expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

import {
  zExperimentVisualization,
  zExperimentVisualizationList,
} from "@repo/api/domains/experiment/visualizations/experiment-visualizations.schema";

import { assertSafeFixtureDatabase, findSeedExperiment } from "../helpers.js";
import type { FixtureTable } from "../ticket-screens/fixture-tables.js";
import { FixtureWarehouse } from "../ticket-screens/fixture-warehouse.js";

export const SENSOR_RUNS: FixtureTable = {
  identifier: "synthetic_sensor_runs",
  displayName: "Synthetic sensor runs",
  defaultSortColumn: "timestamp",
  columns: [
    { name: "id", type_name: "STRING", type_text: "STRING" },
    { name: "timestamp", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
    { name: "sensor", type_name: "STRING", type_text: "STRING" },
    { name: "site", type_name: "STRING", type_text: "STRING" },
    { name: "reading", type_name: "DOUBLE", type_text: "DOUBLE" },
  ],
  rows: [0, 120, 300, 540, 840, 1200].flatMap((seconds, index) =>
    ["Sensor A", "Sensor B"].map((sensor, offset) => ({
      id: `${offset}-${index}`,
      timestamp: new Date(Date.UTC(2026, 5, 1, 10) + (seconds + offset * 30) * 1000).toISOString(),
      sensor,
      site: offset ? "East plot" : "West plot",
      reading: 10 + index * 3 + offset * 2,
    })),
  ),
};

export async function installSensorRuns(page: Page): Promise<string> {
  const experiment = await findSeedExperiment();
  await new FixtureWarehouse(experiment.id, [SENSOR_RUNS]).install(page);
  return experiment.id;
}

const apiUrl = process.env.E2E_API_URL ?? "http://localhost:3020";

async function prepareSensorChart(page: Page): Promise<string> {
  const name = "Synthetic sensor run documentation";
  assertSafeFixtureDatabase();
  const experiment = await findSeedExperiment();
  const endpoint = `${apiUrl}/api/v1/experiments/${experiment.id}/visualizations`;
  const data = {
    name,
    description: "Synthetic sensor reports with known time intervals",
    chartFamily: "basic",
    chartType: "line",
    config: {
      title: "Synthetic sensor runs",
      xAxisTitle: "Report time",
      xAxisType: "date",
      yAxisType: "linear",
      yAxisTitle: "reading",
      showLegend: true,
      showGrid: true,
      mode: "lines+markers",
      connectgaps: false,
    },
    dataConfig: {
      tableName: SENSOR_RUNS.identifier,
      dataSources: [
        { tableName: SENSOR_RUNS.identifier, columnName: "timestamp", role: "x" },
        { tableName: SENSOR_RUNS.identifier, columnName: "reading", role: "y" },
      ],
    },
  };
  const listed = await page.request.get(endpoint);
  if (!listed.ok()) throw new Error(`Could not list synthetic charts: ${listed.status()}`);
  const existingId = zExperimentVisualizationList
    .parse(await listed.json())
    .find((chart) => chart.name === name)?.id;
  const response = existingId
    ? await page.request.patch(`${endpoint}/${existingId}`, { data })
    : await page.request.post(endpoint, { data });
  if (!response.ok()) throw new Error(`Could not prepare synthetic chart: ${response.status()}`);
  const chart = zExperimentVisualization.parse(await response.json());
  return `/platform/experiments/${experiment.id}/analysis/visualizations/${chart.id}`;
}

export function control(page: Page, label: string, index = 0): Locator {
  return page.getByText(label, { exact: true }).nth(index).locator("..").getByRole("combobox");
}

export async function choose(
  page: Page,
  label: string,
  option: string | RegExp,
  index = 0,
): Promise<void> {
  await control(page, label, index).click();
  await page.getByRole("option", { name: option, exact: true }).press("Enter");
  await expect(page.getByRole("listbox")).toHaveCount(0);
}

export async function openSyntheticChart(page: Page): Promise<string> {
  await installSensorRuns(page);
  const route = await prepareSensorChart(page);
  const base = new URL(page.url()).origin;
  await page.goto(`${base}/en-US${route}`);
  await expect(control(page, "Aggregate")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator(".js-plotly-plot").first()).toBeVisible({ timeout: 60_000 });
  return route;
}

export async function configureGap(page: Page): Promise<void> {
  await choose(page, "Aggregate", "Change from previous");
  await choose(page, "Column", /^timestamp/, 1);
  await choose(page, "Per", "sensor");
  await chooseOrderedBy(page, "timestamp");
}

export async function chooseOrderedBy(page: Page, column: string): Promise<void> {
  const [saved] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        new URL(response.url()).pathname.includes("/visualizations/"),
      { timeout: 15_000 },
    ),
    choose(page, "Ordered by", column),
  ]);
  expect(saved.ok()).toBe(true);
  await expect(page.locator(".js-plotly-plot").first()).toBeVisible({ timeout: 60_000 });
}
