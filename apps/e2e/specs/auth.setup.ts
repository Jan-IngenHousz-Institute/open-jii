import fs from "node:fs/promises";
import path from "node:path";

import { readLatestSignInOtp } from "@repo/devkit/otp";

import { expect, test as setup } from "../fixtures.js";
import {
  databaseUrl,
  dismissCookieBanner,
  locale,
  seedEmail,
  waitForFreshOtp,
} from "../helpers.js";

const authFile = path.join(import.meta.dirname, "..", ".auth", "seed.json");

setup("authenticate as the seed user", async ({ page }) => {
  await fs.mkdir(path.dirname(authFile), { recursive: true });
  await page.goto(`/${locale}/login`, { waitUntil: "domcontentloaded" });
  await dismissCookieBanner(page);

  const emailInput = page.getByPlaceholder("Enter your email...");
  await emailInput.fill(seedEmail);
  await expect(emailInput).toHaveValue(seedEmail);

  const previousOtp = await readLatestSignInOtp(databaseUrl, seedEmail).catch(() => null);
  await page.getByRole("button", { name: "Continue with Email" }).click();
  const otp = await waitForFreshOtp(databaseUrl, seedEmail, previousOtp);

  const codeInput = page.locator('input[autocomplete="one-time-code"]');
  await expect(codeInput).toBeVisible({ timeout: 10_000 });
  await codeInput.fill(otp);
  await page.waitForURL(`**/${locale}/platform`, { timeout: 15_000 });

  const passkeyDismiss = page.getByRole("button", { name: "Not now" });
  const passkeyPromptAppeared = await passkeyDismiss
    .waitFor({ state: "visible", timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  if (passkeyPromptAppeared) await passkeyDismiss.click();

  await page.context().storageState({ path: authFile });
});
