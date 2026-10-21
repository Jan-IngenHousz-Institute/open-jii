import { expect, test } from "../fixtures.js";
import { dismissCookieBanner, locale } from "../helpers.js";

test("platform admins appoint researchers and create a public Demo organization", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto(`/${locale}/platform/platform-admins`);
  await dismissCookieBanner(page);
  await expect(page.getByRole("heading", { name: "Platform admins", exact: true })).toBeVisible();
  await expect(page.getByText("Set by deployment configuration")).toBeVisible();
  await page.getByLabel("Find a researcher by name").fill("Newcomer");
  await expect(page.getByText("Newcomer User", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Appoint admin", exact: true }).click();
  await expect(page.getByText("Platform admin appointed.")).toBeVisible();
  await page
    .getByRole("button", { name: "Remove Newcomer User as a platform admin", exact: true })
    .click();
  await expect(page.getByText("Platform admin removed.")).toBeVisible();

  await page.goto(`/${locale}/platform/organizations/new`);
  const name = "Demo browser check";
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Demo", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("radio", { name: /Private/ })).toBeDisabled();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Create organization", exact: true }).click();
  await page.waitForURL(/\/organizations\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.getByText("Demo", { exact: true }).first()).toBeVisible();
  await page.goto(`/${locale}/platform/organizations?type=demo`);
  await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/${locale}/platform/platform-admins`);
  await expect(page.getByRole("heading", { name: "Platform admins", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
