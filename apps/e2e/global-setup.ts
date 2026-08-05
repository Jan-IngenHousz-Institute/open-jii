import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

import { readLatestSignInOtp } from "@repo/devkit/otp";

import { dismissCookieBanner, waitForFreshOtp } from "./helpers.js";

const seedEmail = process.env.E2E_EMAIL ?? "seed@openjii.local";
const locale = process.env.E2E_LOCALE ?? "en-US";
const databaseUrl =
  process.env.E2E_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5432/openjii_local";

export default async function globalSetup(): Promise<void> {
  const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
  const authPath = path.join(import.meta.dirname, ".auth", "seed.json");
  await fs.mkdir(path.dirname(authPath), { recursive: true });

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${baseURL}/${locale}/login`, { waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);

    const emailInput = page.getByPlaceholder("Enter your email...");
    await emailInput.click();
    await emailInput.pressSequentially(seedEmail, { delay: 20 });

    const previousOtp = await readLatestSignInOtp(databaseUrl, seedEmail).catch(() => null);
    await page.getByRole("button", { name: "Continue with Email" }).click();
    const otp = await waitForFreshOtp(databaseUrl, seedEmail, previousOtp);

    const codeInput = page.locator('input[autocomplete="one-time-code"]');
    await codeInput.waitFor({ state: "visible", timeout: 10_000 });
    await codeInput.pressSequentially(otp, { delay: 40 });
    await page.waitForURL(`**/${locale}/platform`, { timeout: 15_000 });
    const passkeyDismiss = page.getByRole("button", { name: "Not now" });
    if (
      await passkeyDismiss
        .waitFor({ state: "visible", timeout: 5_000 })
        .then(() => true)
        .catch(() => false)
    ) {
      await passkeyDismiss.click();
    }
    await context.storageState({ path: authPath });
  } finally {
    await browser.close();
  }
}
