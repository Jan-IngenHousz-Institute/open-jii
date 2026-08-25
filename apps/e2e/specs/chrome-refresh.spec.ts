import { expect, test } from "../fixtures.js";
import { dismissCookieBanner, findSeedExperiment, locale } from "../helpers.js";

test("navigation keyboard shortcuts work", async ({ page }) => {
  await page.goto(`/${locale}/platform`, { waitUntil: "networkidle" });
  await dismissCookieBanner(page);
  await expect(page).toHaveURL(new RegExp(`/${locale}/platform$`));
  await expect(page.getByRole("link", { name: "Experiments" })).toBeVisible();

  const sidebar = page.locator("[data-state][data-collapsible]").first();
  const initialSidebarState = await sidebar.getAttribute("data-state");
  if (!initialSidebarState) throw new Error("Sidebar has no data-state attribute");
  await page.keyboard.press("ControlOrMeta+b");
  await expect(sidebar).not.toHaveAttribute("data-state", initialSidebarState);
  await page.keyboard.press("ControlOrMeta+b");
  await expect(sidebar).toHaveAttribute("data-state", initialSidebarState);

  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await expect(palette).toBeVisible();
  await expect(page.getByRole("option", { name: /^Home/ }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(palette).not.toBeVisible();

  await page.getByRole("link", { name: "Experiments" }).focus();
  await page.keyboard.press("g");
  await page.keyboard.press("e");
  await page.waitForURL(`**/${locale}/platform/experiments`);
  await expect(page.getByRole("heading", { name: "Experiments", level: 1 })).toBeVisible();
});

test("activity and account navigation remain usable", async ({ page }) => {
  await page.goto(`/${locale}/platform`, { waitUntil: "networkidle" });
  await dismissCookieBanner(page);
  await page.getByRole("button", { name: /^Activity/ }).click();
  const activityHeading = page.getByRole("heading", { name: "Activity" });
  await expect(activityHeading).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(activityHeading).not.toBeVisible();

  // Direct-load coverage stays isolated in the fixme below while the hydration bug remains.
  await page.getByRole("button", { name: /SE|JII/ }).click();
  await page.getByRole("menuitem", { name: "Account" }).click();
  await page.waitForURL(`**/${locale}/platform/account`);
  await page.getByRole("tab", { name: "Security" }).click();
  await page.waitForURL(`**/${locale}/platform/account/security`);
  await expect(page.getByRole("tab").first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: /Security/i }).first()).toBeVisible();
});

test("experiment pages render without runtime errors", async ({ page }) => {
  const experiment = await findSeedExperiment();
  await page.goto(`/${locale}/platform/experiments/${experiment.id}`, {
    waitUntil: "networkidle",
  });
  await dismissCookieBanner(page);
  await expect(page.getByRole("heading", { name: experiment.name, level: 1 })).toBeVisible();

  await page.goto(`/${locale}/platform/experiments/${experiment.id}/data`, {
    waitUntil: "networkidle",
  });
  await expect(page.getByText(/Application error|Unhandled Runtime Error/)).toHaveCount(0);
});

test.fixme("direct account-page loads hydrate without browser errors", async ({ page }) => {
  await page.goto(`/${locale}/platform/account`, { waitUntil: "networkidle" });
  await expect(page.getByRole("tab", { name: "General" })).toBeVisible();
});
