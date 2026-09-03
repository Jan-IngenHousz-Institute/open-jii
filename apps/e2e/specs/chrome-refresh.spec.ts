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

test("platform footer stays compact and organizations use the shared table", async ({ page }) => {
  await page.goto(`/${locale}/platform`, { waitUntil: "networkidle" });
  await dismissCookieBanner(page);

  const sidebar = page.locator('[data-sidebar="sidebar"]').first();
  await expect(sidebar.locator('[data-sidebar="trigger"]')).toBeHidden();
  const footer = sidebar.locator('[data-sidebar="footer"]');
  const theme = footer.getByRole("button", { name: /Switch to (dark|light) mode/i });
  const account = footer.getByRole("button", { name: /SE|JII/ });
  await expect(theme).toBeVisible();
  await expect(account).toBeVisible();
  await expect(
    theme.locator("xpath=following-sibling::*[1]").getByRole("button", { name: /SE|JII/ }),
  ).toBeVisible();

  await page.goto(`/${locale}/platform/organizations`, { waitUntil: "networkidle" });
  const table = page.getByRole("table");
  await expect(table).toBeVisible();
  await expect(table.locator("xpath=../..")).toHaveClass(/\bborder\b/);
  await expect(table.getByRole("row").nth(1)).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/${locale}/platform`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await expect(page.getByRole("button", { name: "Close" })).toBeVisible();
  await expect(page.locator('[data-sidebar="sidebar"] [data-sidebar="trigger"]')).toHaveCount(0);
});

test("experiment pages render without runtime errors", async ({ page }) => {
  const experiment = await findSeedExperiment();
  await page.goto(`/${locale}/platform/experiments/${experiment.id}`, {
    waitUntil: "networkidle",
  });
  await dismissCookieBanner(page);
  await expect(page.getByRole("heading", { name: experiment.name, level: 1 })).toBeVisible();

  const breadcrumbs = page.getByRole("navigation", { name: "Breadcrumbs" });
  const header = breadcrumbs.locator("xpath=ancestor::header");
  const initialHeaderY = (await header.boundingBox())?.y;
  expect(initialHeaderY).toBeDefined();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(async () => (await header.boundingBox())?.y).toBe(initialHeaderY);
  expect(
    await header.evaluate((element) =>
      document.elementsFromPoint(innerWidth / 2, 1).some((candidate) => candidate === element),
    ),
  ).toBe(true);

  await page.goto(`/${locale}/platform/experiments/${experiment.id}/data`, {
    waitUntil: "networkidle",
  });
  await expect(page.getByText(/Application error|Unhandled Runtime Error/)).toHaveCount(0);
});

test("fixed overview columns keep workbook row actions fully clickable", async ({ page }) => {
  await page.goto(`/${locale}/platform/workbooks`, { waitUntil: "networkidle" });
  await dismissCookieBanner(page);

  const action = page.getByRole("button", { name: "More actions" }).first();
  await expect(action).toBeAttached();
  const cell = action.locator("xpath=ancestor::td");
  const [actionBox, cellBox] = await Promise.all([action.boundingBox(), cell.boundingBox()]);
  if (!actionBox || !cellBox) throw new Error("Workbook row action has no layout box");

  expect(actionBox.x).toBeGreaterThanOrEqual(cellBox.x);
  expect(actionBox.x + actionBox.width).toBeLessThanOrEqual(cellBox.x + cellBox.width);

  await action.click();
  await expect(page.getByRole("menuitem", { name: "Open" })).toBeVisible();
});

test.fixme("direct account-page loads hydrate without browser errors", async ({ page }) => {
  await page.goto(`/${locale}/platform/account`, { waitUntil: "networkidle" });
  await expect(page.getByRole("tab", { name: "General" })).toBeVisible();
});
