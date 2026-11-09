import { expect, test } from "../fixtures.js";
import { dismissCookieBanner, expectSearchSurvivesReopen, locale } from "../helpers.js";

const experimentListUrl = /\/api\/v1\/experiments(?:\?|$)/;

function arrayParam(url: string, key: string): string[] {
  const params = new URL(url).searchParams;
  return [...params.keys()]
    .filter((name) => name.startsWith(`${key}[`))
    .map((name) => params.get(name) ?? "");
}

test("a shared filtered link opens the filtered list and clears back to all", async ({ page }) => {
  const filtered = page.waitForResponse(
    (response) =>
      experimentListUrl.test(response.url()) &&
      arrayParam(response.url(), "status").join() === "active" &&
      arrayParam(response.url(), "visibility").join() === "public",
  );

  await page.goto(`/${locale}/platform/experiments?status=active&visibility=public`);
  await dismissCookieBanner(page);
  await filtered;

  await expect(page.getByRole("group", { name: "Status is Active" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Visibility is Public" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "[Seed] Winter Wheat Phenotyping" }).first(),
  ).toBeVisible();

  const cleared = page.waitForResponse(
    (response) =>
      experimentListUrl.test(response.url()) &&
      arrayParam(response.url(), "status").length === 0 &&
      arrayParam(response.url(), "visibility").length === 0,
  );
  await page.getByRole("button", { name: "Clear filters" }).click();
  await cleared;

  await expect(page).toHaveURL(
    (url) => !url.search.includes("status") && !url.search.includes("visibility"),
  );
  await expect(page.getByRole("button", { name: "Filter", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear filters" })).toHaveCount(0);
});

test("the Filter menu floats over the list, and chips edit and remove values", async ({ page }) => {
  await page.goto(`/${locale}/platform/experiments`);
  await dismissCookieBanner(page);

  const table = page.getByRole("table");
  await expect(table.getByRole("link").first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  const before = await table.boundingBox();

  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await page.getByRole("option", { name: "Status" }).click();
  const statuses = page.getByRole("listbox", { name: "Status" });
  await expect(statuses).toBeVisible();
  expect((await table.boundingBox())?.y).toBe(before?.y);

  await statuses.getByRole("option", { name: "Active" }).click();
  await expect(page).toHaveURL((url) => url.searchParams.get("status") === "active");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(statuses).toHaveCount(0);
  await expect(page.getByRole("listbox", { name: "Filter" })).toHaveCount(0);

  const activeChip = page.getByRole("group", { name: "Status is Active" });
  await activeChip.getByRole("button", { name: "Active", exact: true }).click();
  await page
    .getByRole("listbox", { name: "Status" })
    .getByRole("option", { name: "Stale" })
    .click();
  await expect(page).toHaveURL((url) => url.searchParams.get("status") === "active,stale");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox", { name: "Status" })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Status is Stale" })).toBeVisible();

  await activeChip.getByRole("button", { name: "Remove Status is Active" }).click();
  await expect(page).toHaveURL((url) => url.searchParams.get("status") === "stale");
  await expect(activeChip).toHaveCount(0);
});

test("experiments search survives reload and a shared link with filters and sort", async ({
  page,
}) => {
  const sort = JSON.stringify([{ field: "name", direction: "asc" }]);
  await page.goto(
    `/${locale}/platform/experiments?status=active&visibility=public&sort=${encodeURIComponent(sort)}`,
  );
  await dismissCookieBanner(page);

  await expect(
    page
      .getByRole("link", { name: "[Seed] Soil Health Monitoring — Midwest", exact: true })
      .first(),
  ).toBeVisible();

  const search = page.getByPlaceholder("Search experiments...", { exact: true });
  await search.fill("Wheat");
  await expect(page).toHaveURL((url) => url.searchParams.get("q") === "Wheat");
  await expect(
    page.getByRole("link", { name: "[Seed] Soil Health Monitoring — Midwest", exact: true }),
  ).toHaveCount(0);

  await expectSearchSurvivesReopen(page, {
    search,
    term: "Wheat",
    matchingName: "[Seed] Winter Wheat Phenotyping",
    excludedName: "[Seed] Soil Health Monitoring — Midwest",
  });

  await search.clear();
  await expect(page).toHaveURL((url) => !url.searchParams.has("q"));
  expect(new URL(page.url()).searchParams.get("sort")).toBe(sort);
  for (const [key, value] of new URLSearchParams("status=active&visibility=public")) {
    expect(new URL(page.url()).searchParams.get(key)).toBe(value);
  }
  await expect(
    page
      .getByRole("link", { name: "[Seed] Soil Health Monitoring — Midwest", exact: true })
      .first(),
  ).toBeVisible();
});

test("experiments-archive search survives reload and a shared link with filters and sort", async ({
  page,
}) => {
  const sort = JSON.stringify([{ field: "name", direction: "asc" }]);
  await page.goto(
    `/${locale}/platform/experiments-archive?visibility=public,private&sort=${encodeURIComponent(sort)}`,
  );
  await dismissCookieBanner(page);

  await expect(
    page.getByRole("link", { name: "[Seed] Barley Root Imaging", exact: true }).first(),
  ).toBeVisible();

  const search = page.getByPlaceholder("Search experiments...", { exact: true });
  await search.fill("Lighting");
  await expect(page).toHaveURL((url) => url.searchParams.get("q") === "Lighting");
  await expect(
    page.getByRole("link", { name: "[Seed] Barley Root Imaging", exact: true }),
  ).toHaveCount(0);

  await expectSearchSurvivesReopen(page, {
    search,
    term: "Lighting",
    matchingName: "[Seed] Indoor Lighting Calibration",
    excludedName: "[Seed] Barley Root Imaging",
  });

  await search.clear();
  await expect(page).toHaveURL((url) => !url.searchParams.has("q"));
  expect(new URL(page.url()).searchParams.get("sort")).toBe(sort);
  for (const [key, value] of new URLSearchParams("visibility=public,private")) {
    expect(new URL(page.url()).searchParams.get(key)).toBe(value);
  }
  await expect(
    page.getByRole("link", { name: "[Seed] Barley Root Imaging", exact: true }).first(),
  ).toBeVisible();
});
