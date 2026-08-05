import { expect, test } from "../fixtures.js";
import { dismissCookieBanner, findSeedExperimentId, locale } from "../helpers.js";

async function clearOverlays(page: Parameters<typeof dismissCookieBanner>[0]): Promise<void> {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
}

test("the authenticated navigation shell remains usable", async ({ page }) => {
  await page.goto(`/${locale}/platform`, { waitUntil: "networkidle" });
  await dismissCookieBanner(page);
  await expect(page).toHaveURL(new RegExp(`/${locale}/platform$`));
  await expect(page.getByRole("link", { name: "Experiments" })).toBeVisible();

  const sidebar = page.locator("[data-state][data-collapsible]").first();
  const initialSidebarState = await sidebar.getAttribute("data-state");
  await page.keyboard.press("Control+b");
  await expect(sidebar).not.toHaveAttribute("data-state", initialSidebarState ?? "");
  await page.keyboard.press("Control+b");

  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await expect(palette).toBeVisible();
  await expect(page.getByRole("option", { name: /^Home/ }).first()).toBeVisible();
  await clearOverlays(page);

  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("g");
  await page.keyboard.press("e");
  await page.waitForURL(`**/${locale}/platform/experiments`);
  await expect(page.getByRole("heading", { name: "Experiments", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: /^Activity/ }).click();
  await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible();
  await clearOverlays(page);

  await page.getByRole("button", { name: /SE|JII/ }).click();
  await page.getByRole("menuitem", { name: "Account" }).click();
  await page.waitForURL(`**/${locale}/platform/account`);
  await page.getByRole("tab", { name: "Security" }).click();
  await page.waitForURL(`**/${locale}/platform/account/security`);
  await expect(page.getByRole("tab").first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: /Security/i }).first()).toBeVisible();

  const experimentId = await findSeedExperimentId();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/${locale}/platform/experiments/${experimentId}`, {
    waitUntil: "networkidle",
  });
  const experimentTitle = page.locator(".text-2xl").first();
  await expect(experimentTitle).toBeVisible();
  await expect(experimentTitle.locator("xpath=..").locator("svg").first()).toBeVisible();

  await page.goto(`/${locale}/platform/experiments/${experimentId}/data`, {
    waitUntil: "networkidle",
  });
  await expect(page.getByText(/Application error|Unhandled Runtime Error/)).toHaveCount(0);
});
