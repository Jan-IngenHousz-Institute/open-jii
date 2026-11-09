import { expect, test } from "../fixtures.js";
import { dismissCookieBanner, expectSearchSurvivesReopen, locale } from "../helpers.js";

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

  await expect(page.getByRole("group", { name: "Language is R" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Visibility is Public" })).toBeVisible();
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
  await expect(page.getByRole("button", { name: "Filter", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear filters" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "[Seed] ANOVA Analysis" })).toBeVisible();
  await expect(page.getByRole("link", { name: "[Seed] Phi2 Quantum Yield" })).toBeVisible();
});

test("macros search survives reload and a shared link with filters and sort", async ({ page }) => {
  const sort = JSON.stringify([{ field: "name", direction: "asc" }]);
  await page.goto(
    `/${locale}/platform/macros?language=r&visibility=public&sort=${encodeURIComponent(sort)}`,
  );
  await dismissCookieBanner(page);

  await expect(
    page.getByRole("link", { name: "[Seed] Statistical Summary", exact: true }).first(),
  ).toBeVisible();

  const search = page.getByPlaceholder("Search macros...", { exact: true });
  await search.fill("ANOVA");
  await expect(page).toHaveURL((url) => url.searchParams.get("q") === "ANOVA");
  await expect(
    page.getByRole("link", { name: "[Seed] Statistical Summary", exact: true }),
  ).toHaveCount(0);

  await expectSearchSurvivesReopen(page, {
    search,
    term: "ANOVA",
    matchingName: "[Seed] ANOVA Analysis",
    excludedName: "[Seed] Statistical Summary",
  });

  await search.clear();
  await expect(page).toHaveURL((url) => !url.searchParams.has("q"));
  expect(new URL(page.url()).searchParams.get("sort")).toBe(sort);
  for (const [key, value] of new URLSearchParams("language=r&visibility=public")) {
    expect(new URL(page.url()).searchParams.get(key)).toBe(value);
  }
  await expect(
    page.getByRole("link", { name: "[Seed] Statistical Summary", exact: true }).first(),
  ).toBeVisible();
});
