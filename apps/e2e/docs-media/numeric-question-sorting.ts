import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

import {
  dataRequest,
  mockNumericQuestionSorting,
  numericSortExperimentName,
} from "../numeric-question-sorting-fixtures.js";
import type { RequestStep } from "../numeric-question-sorting-fixtures.js";
import { experimentId } from "./seed-entities.js";
import type { Shot } from "./shots.js";

const route = async () =>
  `/platform/experiments/${await experimentId(numericSortExperimentName)}/data`;
const answer = (page: Page) => page.getByRole("columnheader", { name: "answer", exact: true });
const next = (page: Page) => page.getByTitle("Next", { exact: true });
const pause = (page: Page) => page.waitForTimeout(1600);

async function openFixture(page: Page, steps: RequestStep[]) {
  const url = page.url();
  // Stop the live view so its retries cannot consume the capture's strict request plan.
  await page.goto("about:blank");
  await mockNumericQuestionSorting(page, await experimentId(numericSortExperimentName), steps);
  await page.goto(url, { waitUntil: "networkidle" });
}

export const NUMERIC_QUESTION_SORTING_SHOTS: readonly Shot[] = [
  {
    slug: "numeric-question-sorting-ascending",
    publish: "img/guide/web/numeric-question-sorting-ascending.webp",
    frame: "desktop",
    route,
    async prepare(page) {
      await openFixture(page, [
        { request: dataRequest(1, "id", "DESC") },
        { request: dataRequest(1, "id", "DESC", 20) },
        { request: dataRequest(1, "answer", "ASC", 20) },
      ]);
      await page.getByRole("combobox").filter({ hasText: "10" }).click();
      await page.getByRole("option", { name: "20", exact: true }).click();
      await expect(page.getByText("Page 1 of 2", { exact: true })).toBeVisible();
      await answer(page).click();
      await expect(page.getByRole("cell", { name: "001", exact: true }).first()).toBeVisible();
      await expect(page.getByRole("cell", { name: "100", exact: true }).first()).toBeVisible();
    },
    scope: "Numeric question answers ascending, with original leading zeros and synthetic data",
  },
  {
    slug: "numeric-question-sorting",
    publish: "videos/guide/web/numeric-question-sorting.webm",
    frame: "desktop",
    route,
    async prepare(page) {
      await openFixture(page, [
        { request: dataRequest(1, "id", "DESC") },
        { request: dataRequest(2, "id", "DESC") },
        { request: dataRequest(1, "answer", "ASC") },
        { request: dataRequest(2, "answer", "ASC") },
        { request: dataRequest(1, "answer", "DESC") },
        { request: dataRequest(1, "sample_answer", "ASC") },
      ]);
      await next(page).click();
      await expect(page.getByText("Page 2 of 3", { exact: true })).toBeVisible();
      await page.getByRole("checkbox", { name: "Select row", exact: true }).first().click();
      await expect(page.getByText("1 row selected", { exact: true })).toBeVisible();
    },
    async perform(page) {
      await pause(page);
      await answer(page).hover();
      await answer(page).click();
      await expect(page.getByText("Page 1 of 3", { exact: true })).toBeVisible();
      await expect(page.getByText("No rows selected", { exact: true })).toBeVisible();
      await expect(page.getByRole("cell", { name: "001", exact: true }).first()).toBeVisible();
      await pause(page);
      await next(page).click();
      await expect(page.getByText("Page 2 of 3", { exact: true })).toBeVisible();
      await pause(page);
      await answer(page).click();
      await expect(page.getByText("Page 1 of 3", { exact: true })).toBeVisible();
      await expect(page.getByRole("cell", { name: "100", exact: true }).first()).toBeVisible();
      await pause(page);
      await page.getByRole("columnheader", { name: /sample Question/ }).click();
      await expect(page.getByRole("cell", { name: "001", exact: true }).first()).toBeVisible();
    },
    tailSeconds: 3,
    scope:
      "Page and selection reset, ascending/descending and renamed question sorting with synthetic data",
  },
];
