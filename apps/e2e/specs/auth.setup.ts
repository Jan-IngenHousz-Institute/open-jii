import type { Page } from "@playwright/test";
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
const newcomerAuthFile = path.join(import.meta.dirname, "..", ".auth", "newcomer.json");

async function authenticate(page: Page, email: string, outputFile: string) {
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await page.goto(`/${locale}/login`, { waitUntil: "domcontentloaded" });
  await dismissCookieBanner(page);

  const emailInput = page.getByPlaceholder("Enter your email...");
  await emailInput.fill(email);
  await expect(emailInput).toHaveValue(email);

  const previousOtp = await readLatestSignInOtp(databaseUrl, email).catch(() => null);
  await page.getByRole("button", { name: "Continue with Email" }).click();
  const otp = await waitForFreshOtp(databaseUrl, email, previousOtp);

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

  await page.context().storageState({ path: outputFile });
}

setup("authenticate as the seed user", async ({ page }) => {
  await authenticate(page, seedEmail, authFile);
});

setup("authenticate as the newcomer", async ({ page }) => {
  await authenticate(page, "newcomer@openjii.local", newcomerAuthFile);
});
