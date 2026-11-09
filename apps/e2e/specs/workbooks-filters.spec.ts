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

  await expect(page.getByRole("group", { name: "Visibility is Public" })).toBeVisible();
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
  await expect(page.getByRole("button", { name: "Filter", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear filters" })).toHaveCount(0);
});

test("workbooks search survives reload and a shared link with filters and sort", async ({
  page,
}) => {
  const sort = JSON.stringify([{ field: "name", direction: "asc" }]);
  await page.goto(
    `/${locale}/platform/workbooks?visibility=public&sort=${encodeURIComponent(sort)}`,
  );
  await dismissCookieBanner(page);

  await expect(
    page.getByRole("link", { name: "[Seed] Corn Measurement Workbook", exact: true }).first(),
  ).toBeVisible();

  const search = page.getByPlaceholder("Search workbooks...", { exact: true });
  await search.fill("Wheat");
  await expect(page).toHaveURL((url) => url.searchParams.get("q") === "Wheat");
  await expect(
    page.getByRole("link", { name: "[Seed] Corn Measurement Workbook", exact: true }),
  ).toHaveCount(0);
  const sharedUrl = page.url();

  for (const reopen of ["reload", "shared link"]) {
    if (reopen === "reload") await page.reload();
    else {
      await page.goto("about:blank");
      await page.goto(sharedUrl);
    }

    await expect(search).toHaveValue("Wheat");
    await expect(
      page.getByRole("link", { name: "[Seed] Wheat Phenotyping Workbook", exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "[Seed] Corn Measurement Workbook", exact: true }),
    ).toHaveCount(0);
    await expect(page).toHaveURL(sharedUrl);
  }

  await search.clear();
  await expect(page).toHaveURL((url) => !url.searchParams.has("q"));
  expect(new URL(page.url()).searchParams.get("sort")).toBe(sort);
  for (const [key, value] of new URLSearchParams("visibility=public")) {
    expect(new URL(page.url()).searchParams.get(key)).toBe(value);
  }
  await expect(
    page.getByRole("link", { name: "[Seed] Corn Measurement Workbook", exact: true }).first(),
  ).toBeVisible();
});
