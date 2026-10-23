import { expect, test } from "../fixtures.js";
import {
  deleteFixtureOrganization,
  dismissCookieBanner,
  locale,
  newcomerEmail,
  removePlatformAdminRole,
} from "../helpers.js";

const demoName = "Demo browser check";
const demoSlug = "demo-browser-check";

// A failed attempt leaves the appointment and the organization behind, and the retry would find
// Newcomer already appointed and the slug taken.
async function resetFixtures() {
  await removePlatformAdminRole(newcomerEmail);
  await deleteFixtureOrganization(demoSlug, demoName);
}

test.beforeEach(resetFixtures);
test.afterEach(resetFixtures);

test("platform admins appoint researchers and create a public Demo organization", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto(`/${locale}/platform/platform-admins`);
  await dismissCookieBanner(page);
  await expect(
    page.getByRole("heading", { name: "Platform admins", exact: true }),
    "Start the backend with ADMIN_USER_IDS set to the seed user; see apps/e2e/README.md",
  ).toBeVisible();
  await expect(page.getByText("Set by deployment configuration")).toBeVisible();
  await page.getByLabel("Find a researcher by name").fill("Newcomer");
  await expect(page.getByText("Newcomer User", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Appoint admin: Newcomer User", exact: true }).click();
  await expect(page.getByText("Platform admin appointed.")).toBeVisible();
  await page.getByRole("button", { name: "Remove admin: Newcomer User", exact: true }).click();
  await expect(page.getByText("Platform admin removed.")).toBeVisible();

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
