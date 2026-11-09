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

  await expect(page.getByRole("group", { name: "Family is Ambyte" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Visibility is Public" })).toBeVisible();
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
  await expect(page.getByRole("button", { name: "Filter", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear filters" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "[Seed] Soil Moisture Probe" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "[Seed] Chlorophyll Fluorescence v1" }),
  ).toBeVisible();
});

test("protocols search survives reload and a shared link with filters and sort", async ({
  page,
}) => {
  const sort = JSON.stringify([{ field: "name", direction: "asc" }]);
  await page.goto(
    `/${locale}/platform/protocols?family=ambyte&visibility=public&sort=${encodeURIComponent(sort)}`,
  );
  await dismissCookieBanner(page);

  await expect(
    page.getByRole("link", { name: "[Seed] Ambient Light & Temperature", exact: true }).first(),
  ).toBeVisible();

  const search = page.getByPlaceholder("Search protocols...", { exact: true });
  await search.fill("Soil");
  await expect(page).toHaveURL((url) => url.searchParams.get("q") === "Soil");
  await expect(
    page.getByRole("link", { name: "[Seed] Ambient Light & Temperature", exact: true }),
  ).toHaveCount(0);
  const sharedUrl = page.url();

  for (const reopen of ["reload", "shared link"]) {
    if (reopen === "reload") await page.reload();
    else {
      await page.goto("about:blank");
      await page.goto(sharedUrl);
    }

    await expect(search).toHaveValue("Soil");
    await expect(
      page.getByRole("link", { name: "[Seed] Soil Moisture Probe", exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "[Seed] Ambient Light & Temperature", exact: true }),
    ).toHaveCount(0);
    await expect(page).toHaveURL(sharedUrl);
  }

  await search.clear();
  await expect(page).toHaveURL((url) => !url.searchParams.has("q"));
  expect(new URL(page.url()).searchParams.get("sort")).toBe(sort);
  for (const [key, value] of new URLSearchParams("family=ambyte&visibility=public")) {
    expect(new URL(page.url()).searchParams.get(key)).toBe(value);
  }
  await expect(
    page.getByRole("link", { name: "[Seed] Ambient Light & Temperature", exact: true }).first(),
  ).toBeVisible();
});
