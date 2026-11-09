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

  await expect(page.getByRole("group", { name: "Type is University" })).toBeVisible();
  await expect(page.getByRole("link", { name: "[Seed] Northfield University" })).toBeVisible();
  await expect(page.getByRole("link", { name: "[Seed] Leaf Physiology Institute" })).toHaveCount(0);

  const cleared = page.waitForResponse(
    (response) =>
      organizationListUrl.test(response.url()) && arrayParam(response.url(), "type").length === 0,
  );
  await page.getByRole("button", { name: "Clear filters" }).click();
  await cleared;

  await expect(page).toHaveURL((url) => !url.search.includes("type"));
  await expect(page.getByRole("button", { name: "Filter", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear filters" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "[Seed] Northfield University" })).toBeVisible();
  await expect(page.getByRole("link", { name: "[Seed] Leaf Physiology Institute" })).toBeVisible();
});

test("organizations search survives reload and a shared link with filters and sort", async ({
  page,
}) => {
  const sort = JSON.stringify([{ field: "name", direction: "asc" }]);
  await page.goto(
    `/${locale}/platform/organizations?type=university,research_institute&sort=${encodeURIComponent(sort)}`,
  );
  await dismissCookieBanner(page);

  await expect(
    page.getByRole("link", { name: "[Seed] Leaf Physiology Institute", exact: true }).first(),
  ).toBeVisible();

  const search = page.getByPlaceholder("Search organizations…", { exact: true });
  await search.fill("Northfield");
  await expect(page).toHaveURL((url) => url.searchParams.get("q") === "Northfield");
  await expect(
    page.getByRole("link", { name: "[Seed] Leaf Physiology Institute", exact: true }),
  ).toHaveCount(0);
  const sharedUrl = page.url();

  for (const reopen of ["reload", "shared link"]) {
    if (reopen === "reload") await page.reload();
    else {
      await page.goto("about:blank");
      await page.goto(sharedUrl);
    }

    await expect(search).toHaveValue("Northfield");
    await expect(
      page.getByRole("link", { name: "[Seed] Northfield University", exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "[Seed] Leaf Physiology Institute", exact: true }),
    ).toHaveCount(0);
    await expect(page).toHaveURL(sharedUrl);
  }

  await search.clear();
  await expect(page).toHaveURL((url) => !url.searchParams.has("q"));
  expect(new URL(page.url()).searchParams.get("sort")).toBe(sort);
  for (const [key, value] of new URLSearchParams("type=university,research_institute")) {
    expect(new URL(page.url()).searchParams.get(key)).toBe(value);
  }
  await expect(
    page.getByRole("link", { name: "[Seed] Leaf Physiology Institute", exact: true }).first(),
  ).toBeVisible();
});

test("organization resource search survives reload and a shared link", async ({ page }) => {
  await page.goto(`/${locale}/platform/organizations`);
  await dismissCookieBanner(page);
  const organization = page.getByRole("link", {
    name: "[Seed] Northfield University",
    exact: true,
  });
  await expect(organization).toBeVisible();
  const href = await organization.getAttribute("href");
  if (!href) throw new Error("Seed organization has no link");

  // Seed organizations have no resources. Supply two rows at the read boundary so the
  // browser can exercise the actual resource search without mutating shared data.
  await page.route(/\/api\/v1\/organizations\/[^/]+\/resources(?:\?|$)/, (route) =>
    route.fulfill({
      json: {
        resources: [
          {
            id: "00000000-0000-4000-8000-000000000001",
            type: "workbook",
            name: "Wheat field workbook",
            description: null,
            visibility: "public",
            updatedAt: "2026-01-01T00:00:00.000Z",
            collaboratorCount: 1,
          },
          {
            id: "00000000-0000-4000-8000-000000000002",
            type: "workbook",
            name: "Corn field workbook",
            description: null,
            visibility: "public",
            updatedAt: "2026-01-01T00:00:00.000Z",
            collaboratorCount: 1,
          },
        ],
        totals: {
          experiment: 0,
          protocol: 0,
          macro: 0,
          workbook: 2,
          device: 0,
          device_group: 0,
          calibration_definition: 0,
        },
      },
    }),
  );

  const sort = JSON.stringify([{ field: "name", direction: "asc" }]);
  await page.goto(`${href}?type=workbook&sort=${encodeURIComponent(sort)}`);
  const search = page.getByRole("textbox", { name: "Search this organization's resources" });
  await search.fill("Wheat");
  await expect(page).toHaveURL((url) => url.searchParams.get("q") === "Wheat");
  const sharedUrl = page.url();
  const resources = page.getByRole("list", { name: "Resources", exact: true });

  for (const reopen of ["reload", "shared link"]) {
    if (reopen === "reload") await page.reload();
    else {
      await page.goto("about:blank");
      await page.goto(sharedUrl);
    }

    await expect(search).toHaveValue("Wheat");
    await expect(resources.getByRole("link", { name: "Wheat field workbook" })).toBeVisible();
    await expect(resources.getByRole("link", { name: "Corn field workbook" })).toHaveCount(0);
    await expect(page).toHaveURL(sharedUrl);
  }

  await search.clear();
  await expect(page).toHaveURL((url) => !url.searchParams.has("q"));
  expect(new URL(page.url()).searchParams.get("type")).toBe("workbook");
  expect(new URL(page.url()).searchParams.get("sort")).toBe(sort);
  await expect(resources.getByRole("link", { name: "Corn field workbook" })).toBeVisible();
});
