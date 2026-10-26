import { expect, test } from "../fixtures.js";
import { dismissCookieBanner, locale } from "../helpers.js";

const organizationListUrl = /\/api\/v1\/organizations(?:\?|$)/;

function arrayParam(url: string, key: string): string[] {
  const params = new URL(url).searchParams;
  return [...params.keys()]
    .filter((name) => name.startsWith(`${key}[`))
    .map((name) => params.get(name) ?? "");
}

test("a shared filtered link opens the filtered directory and clears back to all", async ({
  page,
}) => {
  const filtered = page.waitForResponse(
    (response) =>
      organizationListUrl.test(response.url()) &&
      arrayParam(response.url(), "type").join() === "university",
  );

  await page.goto(`/${locale}/platform/organizations?type=university`);
  await dismissCookieBanner(page);
  await filtered;

  await expect(page.getByRole("button", { name: "Type 1 selected" })).toBeVisible();
  await expect(page.getByRole("link", { name: "[Seed] Northfield University" })).toBeVisible();
  await expect(page.getByRole("link", { name: "[Seed] Leaf Physiology Institute" })).toHaveCount(0);

  const cleared = page.waitForResponse(
    (response) =>
      organizationListUrl.test(response.url()) && arrayParam(response.url(), "type").length === 0,
  );
  await page.getByRole("button", { name: "Clear filters" }).click();
  await cleared;

  await expect(page).toHaveURL((url) => !url.search.includes("type"));
  await expect(page.getByRole("button", { name: "Type", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear filters" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "[Seed] Northfield University" })).toBeVisible();
  await expect(page.getByRole("link", { name: "[Seed] Leaf Physiology Institute" })).toBeVisible();
});
