import { expect, test } from "../fixtures.js";
import { dismissCookieBanner, locale } from "../helpers.js";

const macroListUrl = /\/api\/v1\/macros(?:\?|$)/;

function arrayParam(url: string, key: string): string[] {
  const params = new URL(url).searchParams;
  return [...params.keys()]
    .filter((name) => name.startsWith(`${key}[`))
    .map((name) => params.get(name) ?? "");
}

test("a shared filtered link opens the filtered list and clears back to all", async ({ page }) => {
  const filtered = page.waitForResponse(
    (response) =>
      macroListUrl.test(response.url()) &&
      arrayParam(response.url(), "language").join() === "r" &&
      arrayParam(response.url(), "visibility").join() === "public",
  );

  await page.goto(`/${locale}/platform/macros?language=r&visibility=public`);
  await dismissCookieBanner(page);
  await filtered;

  await expect(page.getByRole("button", { name: "Language 1 selected" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Visibility 1 selected" })).toBeVisible();
  await expect(page.getByRole("link", { name: "[Seed] ANOVA Analysis" })).toBeVisible();
  await expect(page.getByRole("link", { name: "[Seed] Phi2 Quantum Yield" })).toHaveCount(0);

  const cleared = page.waitForResponse(
    (response) =>
      macroListUrl.test(response.url()) &&
      arrayParam(response.url(), "language").length === 0 &&
      arrayParam(response.url(), "visibility").length === 0,
  );
  await page.getByRole("button", { name: "Clear filters" }).click();
  await cleared;

  await expect(page).toHaveURL(
    (url) => !url.search.includes("language") && !url.search.includes("visibility"),
  );
  await expect(page.getByRole("button", { name: "Language", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear filters" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "[Seed] ANOVA Analysis" })).toBeVisible();
  await expect(page.getByRole("link", { name: "[Seed] Phi2 Quantum Yield" })).toBeVisible();
});
