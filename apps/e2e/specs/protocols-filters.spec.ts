import { expect, test } from "../fixtures.js";
import { dismissCookieBanner, locale } from "../helpers.js";

const protocolListUrl = /\/api\/v1\/protocols(?:\?|$)/;

function arrayParam(url: string, key: string): string[] {
  const params = new URL(url).searchParams;
  return [...params.keys()]
    .filter((name) => name.startsWith(`${key}[`))
    .map((name) => params.get(name) ?? "");
}

test("a shared filtered link opens the filtered list and clears back to all", async ({ page }) => {
  const filtered = page.waitForResponse(
    (response) =>
      protocolListUrl.test(response.url()) &&
      arrayParam(response.url(), "family").join() === "ambyte" &&
      arrayParam(response.url(), "visibility").join() === "public",
  );

  await page.goto(`/${locale}/platform/protocols?family=ambyte&visibility=public`);
  await dismissCookieBanner(page);
  await filtered;

  await expect(page.getByRole("button", { name: "Family 1 selected" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Visibility 1 selected" })).toBeVisible();
  await expect(page.getByRole("link", { name: "[Seed] Soil Moisture Probe" })).toBeVisible();
  await expect(page.getByRole("link", { name: "[Seed] Chlorophyll Fluorescence v1" })).toHaveCount(
    0,
  );

  const cleared = page.waitForResponse(
    (response) =>
      protocolListUrl.test(response.url()) &&
      arrayParam(response.url(), "family").length === 0 &&
      arrayParam(response.url(), "visibility").length === 0,
  );
  await page.getByRole("button", { name: "Clear filters" }).click();
  await cleared;

  await expect(page).toHaveURL(
    (url) => !url.search.includes("family") && !url.search.includes("visibility"),
  );
  await expect(page.getByRole("button", { name: "Family", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear filters" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "[Seed] Soil Moisture Probe" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "[Seed] Chlorophyll Fluorescence v1" }),
  ).toBeVisible();
});
