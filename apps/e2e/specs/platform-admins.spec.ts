import { expect, test } from "../fixtures.js";
import { deleteFixtureOrganization, dismissCookieBanner, locale } from "../helpers.js";

const demoName = "Demo browser check";
const demoSlug = "demo-browser-check";

// A failed attempt leaves the organization behind, and the retry would find the slug taken.
const resetFixtures = () => deleteFixtureOrganization(demoSlug, demoName);

test.beforeEach(resetFixtures);
test.afterEach(resetFixtures);

test("platform admins see the roster and create a public Demo organization", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto(`/${locale}/platform/platform-admins`);
  await dismissCookieBanner(page);
  await expect(
    page.getByRole("heading", { name: "Platform admins", exact: true }),
    "Run pnpm --filter database db:seed, which makes the seed user a platform admin",
  ).toBeVisible();
  await expect(page.getByText("Seed User", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Appoint|Remove/ })).toHaveCount(0);

  await page.goto(`/${locale}/platform/organizations/new`);
  await page.getByLabel("Name", { exact: true }).fill(demoName);
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Demo", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("radio", { name: /Private/ })).toBeDisabled();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Create organization", exact: true }).click();
  await page.waitForURL(/\/organizations\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: demoName, exact: true })).toBeVisible();
  await expect(page.getByText("Demo", { exact: true }).first()).toBeVisible();
  await page.goto(`/${locale}/platform/organizations?type=demo`);
  await expect(page.getByRole("link", { name: demoName, exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/${locale}/platform/platform-admins`);
  await expect(page.getByRole("heading", { name: "Platform admins", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
