import type { Locator, Page } from "@playwright/test";

import { cleanupDataExperiment, seedDataExperiment } from "../experiment-data-fixtures.js";
import { expect, test } from "../fixtures.js";
import { dismissCookieBanner, locale } from "../helpers.js";
import {
  dataRequest,
  fixtureRows,
  mockNumericQuestionSorting,
  numericSortExperimentName,
  numericSortFilter,
  numericSortRowCount,
} from "../numeric-question-sorting-fixtures.js";
import type { DataRequest, RequestStep } from "../numeric-question-sorting-fixtures.js";

let experimentId: string;
test.setTimeout(90_000);
test.beforeAll(async () => {
  experimentId = await seedDataExperiment(numericSortExperimentName);
});
test.afterAll(async () => {
  await cleanupDataExperiment(numericSortExperimentName);
});

async function openData(page: Page, filters?: string) {
  const search = filters ? `?${new URLSearchParams({ f_raw_data: filters })}` : "";
  await page.goto(`/${locale}/platform/experiments/${experimentId}/data${search}`);
  await dismissCookieBanner(page);
}

async function renderedRows(page: Page) {
  const headers = await page.getByRole("table").getByRole("columnheader").allTextContents();
  // The selection column has no data field. All remaining names are read from the real headers.
  const answerIndex = headers.findIndex((header) => header.trim() === "answer");
  const idIndex = headers.findIndex((header) => header.trim() === "id");
  const rows = page.getByRole("table").locator("tbody tr");
  return Promise.all(
    (await rows.all()).map(async (row) => ({
      id: (await row.locator("td").nth(idIndex).textContent())?.trim(),
      answer: await row.locator("td").nth(answerIndex).textContent(),
    })),
  );
}

function visibleAnswer(answer: string | null) {
  return answer === null ? "" : answer === "" ? "—" : answer;
}

async function expectPage(page: Page, request: DataRequest) {
  const expected = fixtureRows(request).map((row) => ({
    id: row.id,
    answer: visibleAnswer(row.answer),
  }));
  await expect.poll(() => renderedRows(page)).toEqual(expected);
  await expect(
    page.getByText(
      `Page ${request.page} of ${Math.ceil(numericSortRowCount / Number(request.pageSize))}`,
      {
        exact: true,
      },
    ),
  ).toBeVisible();
}

async function clickStep(
  page: Page,
  target: Locator,
  requests: Record<string, string>[],
  expected: DataRequest[],
) {
  await target.click();
  await expectPage(page, expected[expected.length - 1]);
  expect(requests).toEqual(expected);
}

const next = (page: Page) => page.getByTitle("Next", { exact: true });
const heading = (page: Page, name: string) => page.getByRole("columnheader", { name, exact: true });

test("column and direction changes reset page atomically, with a delayed first page", async ({
  page,
}) => {
  let release: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const plan = [
    dataRequest(1, "id", "DESC"),
    dataRequest(2, "id", "DESC"),
    dataRequest(1, "answer", "ASC"),
    dataRequest(2, "answer", "ASC"),
    dataRequest(1, "answer", "DESC"),
    dataRequest(2, "answer", "DESC"),
    dataRequest(1, "sample_answer", "ASC"),
    dataRequest(2, "sample_answer", "ASC"),
    dataRequest(3, "sample_answer", "ASC"),
  ];
  const steps: RequestStep[] = plan.map((request, i) => ({
    request,
    ...(i === 2 ? { waitForRelease: pending } : {}),
  }));
  const { requests, unexpected } = await mockNumericQuestionSorting(page, experimentId, steps);
  await openData(page);
  await expectPage(page, plan[0]);
  expect(requests).toEqual(plan.slice(0, 1));
  await clickStep(page, next(page), requests, plan.slice(0, 2));
  await page.getByRole("checkbox", { name: "Select row", exact: true }).first().click();
  await expect(page.getByText("1 row selected", { exact: true })).toBeVisible();
  await heading(page, "answer").click();
  await expect.poll(() => requests).toEqual(plan.slice(0, 3));
  await expect(
    page.getByText(`Page 1 of ${Math.ceil(numericSortRowCount / 10)}`, { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("table").locator("tbody")).not.toContainText("row-14");
  await expect(
    page.getByRole("table").locator("tbody tr td").filter({ hasText: /^row-/ }),
  ).toHaveCount(0);
  await expect(page.getByText("No rows selected", { exact: true })).toBeVisible();
  release?.();
  await expectPage(page, plan[2]);
  await expect(
    page.getByRole("checkbox", { name: "Select row", exact: true }).first(),
  ).not.toBeChecked();
  expect(requests).toEqual(plan.slice(0, 3));
  await clickStep(page, next(page), requests, plan.slice(0, 4));
  await clickStep(page, heading(page, "answer"), requests, plan.slice(0, 5));
  await clickStep(page, next(page), requests, plan.slice(0, 6));
  await clickStep(
    page,
    page.getByRole("columnheader", { name: /sample Question/ }),
    requests,
    plan.slice(0, 7),
  );
  await clickStep(page, next(page), requests, plan.slice(0, 8));
  await clickStep(page, next(page), requests, plan.slice(0, 9));
  expect(unexpected).toEqual([]);
});

test("DESC to ASC reset preserves URL filters and a changed page size", async ({ page }) => {
  const plan = [
    dataRequest(1, "id", "DESC", 10, numericSortFilter),
    dataRequest(1, "id", "DESC", 20, numericSortFilter),
    dataRequest(2, "id", "DESC", 20, numericSortFilter),
    dataRequest(1, "id", "ASC", 20, numericSortFilter),
    dataRequest(1, "label", "ASC", 20, numericSortFilter),
    dataRequest(2, "label", "ASC", 20, numericSortFilter),
    dataRequest(1, "value", "ASC", 20, numericSortFilter),
  ];
  const { requests, unexpected } = await mockNumericQuestionSorting(
    page,
    experimentId,
    plan.map((request) => ({ request })),
  );
  await openData(page, numericSortFilter);
  await expectPage(page, plan[0]);
  expect(requests).toEqual(plan.slice(0, 1));
  await page.getByRole("combobox").filter({ hasText: "10" }).click();
  await clickStep(
    page,
    page.getByRole("option", { name: "20", exact: true }),
    requests,
    plan.slice(0, 2),
  );
  await clickStep(page, next(page), requests, plan.slice(0, 3));
  await clickStep(page, heading(page, "id"), requests, plan.slice(0, 4));
  await clickStep(page, heading(page, "label"), requests, plan.slice(0, 5));
  await clickStep(page, next(page), requests, plan.slice(0, 6));
  await clickStep(page, heading(page, "value"), requests, plan.slice(0, 7));
  expect(unexpected).toEqual([]);
});
