import { expect, test } from "../fixtures.js";
import { dismissCookieBanner, locale } from "../helpers.js";

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

  await expect(page.getByRole("button", { name: "Status 1 selected" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Visibility 1 selected" })).toBeVisible();
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
  await expect(page.getByRole("button", { name: "Status", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear filters" })).toHaveCount(0);
});
