import { expect, test } from "../fixtures.js";
import { dismissCookieBanner, locale } from "../helpers.js";

const workbookListUrl = /\/api\/v1\/workbooks(?:\?|$)/;

function arrayParam(url: string, key: string): string[] {
  const params = new URL(url).searchParams;
  return [...params.keys()]
    .filter((name) => name.startsWith(`${key}[`))
    .map((name) => params.get(name) ?? "");
}

test("a shared filtered link opens the filtered list and clears back to all", async ({ page }) => {
  const filtered = page.waitForResponse(
    (response) =>
      workbookListUrl.test(response.url()) &&
      arrayParam(response.url(), "visibility").join() === "public",
  );

  await page.goto(`/${locale}/platform/workbooks?visibility=public`);
  await dismissCookieBanner(page);
  await filtered;

  await expect(page.getByRole("button", { name: "Visibility 1 selected" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "[Seed] Wheat Phenotyping Workbook" }).first(),
  ).toBeVisible();

  const cleared = page.waitForResponse(
    (response) =>
      workbookListUrl.test(response.url()) && arrayParam(response.url(), "visibility").length === 0,
  );
  await page.getByRole("button", { name: "Clear filters" }).click();
  await cleared;

  await expect(page).toHaveURL((url) => !url.search.includes("visibility"));
  await expect(page.getByRole("button", { name: "Visibility", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear filters" })).toHaveCount(0);
});
