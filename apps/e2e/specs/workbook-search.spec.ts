import type { Page, Route } from "@playwright/test";

import { expect, test } from "../fixtures.js";
import { dismissCookieBanner, locale } from "../helpers.js";
import type { WorkbookSearchFixtures } from "../workbook-fixtures.js";
import {
  cleanupWorkbookSearchFixtures,
  seedWorkbookSearchFixtures,
  workbookSearchNames,
} from "../workbook-fixtures.js";

const workbookListUrl = /\/api\/v1\/workbooks(?:\?|$)/;
let fixtures: WorkbookSearchFixtures;

test.setTimeout(90_000);

function designUrl(experimentId: string): string {
  return `/${locale}/platform/experiments/${experimentId}/design`;
}

async function openPicker(page: Page): Promise<void> {
  const trigger = page.getByRole("combobox").first();
  await expect(trigger).toBeVisible({ timeout: 30_000 });
  await trigger.click();
  await expect(page.getByPlaceholder(/Search workbook/i)).toBeVisible();
}

async function optionLabels(page: Page): Promise<string[]> {
  return page.getByRole("option").allTextContents();
}

async function search(page: Page, term: string): Promise<string[]> {
  const response = page.waitForResponse(
    (candidate) =>
      workbookListUrl.test(candidate.url()) &&
      candidate.request().method() === "GET" &&
      new URL(candidate.url()).searchParams.get("search") === term,
  );
  await page.getByPlaceholder(/Search workbook/i).fill(term);
  await response;
  await expect(page.locator("[cmdk-group]")).not.toHaveClass(/opacity-60/);
  return optionLabels(page);
}

async function expectTaggedMatches(
  page: Page,
  term: string,
  expected: readonly string[],
): Promise<void> {
  const labels = await search(page, term);
  const expectedNames = new Set(expected);
  for (const name of Object.values(workbookSearchNames)) {
    if (expectedNames.has(name)) expect(labels).toContain(name);
    else expect(labels).not.toContain(name);
  }
}

test.beforeAll(async () => {
  fixtures = await seedWorkbookSearchFixtures();
});

test.afterAll(async () => {
  await cleanupWorkbookSearchFixtures();
});

test("workbook search stays server-backed through search and attach flows", async ({ page }) => {
  const searchUrls: string[] = [];
  page.on("request", (request) => {
    if (workbookListUrl.test(request.url())) searchUrls.push(request.url());
  });

  await page.goto(designUrl(fixtures.experimentId), { waitUntil: "networkidle" });
  await dismissCookieBanner(page);
  await openPicker(page);
  await expect.poll(() => optionLabels(page)).toContain(workbookSearchNames.chlorophyll);

  await expectTaggedMatches(page, "chloro", [workbookSearchNames.chlorophyll]);
  expect(searchUrls.some((url) => new URL(url).searchParams.get("search") === "chloro")).toBe(true);
  await expectTaggedMatches(page, "2", [workbookSearchNames.drought]);
  await expectTaggedMatches(page, "area", [workbookSearchNames.leafArea]);
  await expectTaggedMatches(page, fixtures.creatorName.toLowerCase(), [workbookSearchNames.zephyr]);
  await expectTaggedMatches(page, "notebook", [
    workbookSearchNames.quokka,
    workbookSearchNames.zephyr,
  ]);

  const delayed: (route: Route) => Promise<void> = async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    await route.continue();
  };
  await page.route(workbookListUrl, delayed);
  const staleResponse = page.waitForResponse(workbookListUrl);
  await page.getByPlaceholder(/Search workbook/i).fill("notebook!");
  await expect(page.locator("[cmdk-group]")).toHaveClass(/opacity-60/);
  await expect(page.getByRole("option", { name: workbookSearchNames.quokka })).toBeVisible();
  await expect(page.getByRole("option", { name: workbookSearchNames.zephyr })).toBeVisible();
  await staleResponse;
  await page.unroute(workbookListUrl, delayed);
  await page.waitForLoadState("networkidle");

  const coldDelay: (route: Route) => Promise<void> = async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    await route.continue();
  };
  await page.route(workbookListUrl, coldDelay);
  const coldResponse = page.waitForResponse(workbookListUrl);
  await page.goto(designUrl(fixtures.experimentId), { waitUntil: "domcontentloaded" });
  await openPicker(page);
  await expect(page.getByRole("status")).toHaveText(/Searching workbooks/i);
  await expect(page.getByRole("option", { name: workbookSearchNames.quokka })).not.toBeVisible();
  await coldResponse;
  await page.unroute(workbookListUrl, coldDelay);
  await page.waitForLoadState("networkidle");

  await page.goto(designUrl(fixtures.experimentId), { waitUntil: "networkidle" });
  await openPicker(page);
  await expectTaggedMatches(page, "quokka", [workbookSearchNames.quokka]);
  await page.getByRole("option", { name: workbookSearchNames.quokka }).click();
  const attachResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/v1/experiments/${fixtures.experimentId}/workbook/attach`) &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: /^Attach$/ }).click();
  expect((await attachResponse).ok()).toBe(true);
  await expect(page.getByRole("button", { name: /^Change$/ })).toBeVisible();

  await page.getByRole("button", { name: /^Change$/ }).click();
  await openPicker(page);
  await expectTaggedMatches(page, fixtures.experimentTerm, [workbookSearchNames.quokka]);

  await page.goto(`/${locale}/platform/experiments/new`, { waitUntil: "networkidle" });
  await openPicker(page);
  await expect(page.getByRole("option", { name: "None" })).toBeVisible();
  await expectTaggedMatches(page, "chloro", [workbookSearchNames.chlorophyll]);
});
