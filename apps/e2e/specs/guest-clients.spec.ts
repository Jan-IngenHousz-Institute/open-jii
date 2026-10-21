import { expect, test } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";

import en from "../../../packages/i18n/locales/en-US/common.json" with { type: "json" };

// These flows use the real local demo flag fixture and seeded Demo organization.
test.skip(process.env.E2E_DEMO_MODE !== "true", "Requires the local demo flag fixture");
test.setTimeout(90_000);
test.use({ storageState: { cookies: [], origins: [] } });
for (const [locale, copy] of [["en-US", en.demo]] as const) {
  test(`guest entry, failed leave, reload and successful retry (${locale})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/${locale}/login`);
    const reject = page.getByRole("button", { name: /^(Reject all|Alles weigeren)$/ });
    await reject.click();
    await page.getByRole("button", { name: copy.try, exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText(copy.permanent, { exact: true })).toBeVisible();
    await page.getByLabel(copy.name, { exact: true }).fill("River");
    await page.getByRole("button", { name: copy.continue, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/platform/organizations/[^/]+$`));
    await expect(page.getByRole("heading", { name: "openJII Demo", exact: true })).toBeVisible();
    const destination = page.url();
    await expect(page.getByRole("complementary", { name: copy.try })).toContainText("River");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    const signOut = "**/api/v1/auth/sign-out";
    await page.route(signOut, (route) => route.abort("failed"));
    await page.getByRole("button", { name: copy.leave, exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: copy.leave, exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText(copy.leaveError);
    await expect(page.getByRole("dialog").getByRole("button", { name: copy.retry })).toBeEnabled();
    await page.reload();
    await expect(page.getByRole("complementary", { name: copy.try })).toContainText("River");
    await expect(page).toHaveURL(destination);
    await page.unroute(signOut);
    await page.getByRole("button", { name: copy.leave, exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: copy.leave, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/login$`));
    await page.goto(destination);
    await expect(page).toHaveURL(/\/login/);
  });
}

test("disabling demo admission after opening the prompt prevents entry", async ({ page }) => {
  const stateFile = process.env.E2E_DEMO_FLAG_STATE;
  test.skip(!stateFile, "Requires a writable local demo flag fixture");
  if (!stateFile) return;
  const initial = await readFile(stateFile, "utf8");
  try {
    await page.goto("/en-US/login");
    await page.getByRole("button", { name: "Reject all", exact: true }).click();
    await page.getByRole("button", { name: en.demo.try, exact: true }).click();
    await page.getByLabel(en.demo.name, { exact: true }).fill("River");
    await writeFile(stateFile, "false");
    const response = page.waitForResponse((response) =>
      response.url().endsWith("/sign-in/anonymous"),
    );
    await page.getByRole("button", { name: en.demo.continue, exact: true }).click();
    expect((await response).status()).toBe(403);
    await expect(page.getByRole("alert")).toHaveText(en.demo.unavailable);
    await expect(page.getByLabel(en.demo.name, { exact: true })).toHaveValue("River");
    await expect(page).toHaveURL(/\/login/);
  } finally {
    await writeFile(stateFile, initial);
  }
});
