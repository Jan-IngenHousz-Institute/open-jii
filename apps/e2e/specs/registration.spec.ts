import postgres from "postgres";

import { readLatestSignInOtp } from "@repo/devkit/otp";

import { expect, test } from "../fixtures.js";
import {
  assertSafeFixtureDatabase,
  databaseUrl,
  dismissCookieBanner,
  locale,
  waitForFreshOtp,
} from "../helpers.js";

const email = "e2e-registration@openjii.local";

async function deleteAccount(): Promise<void> {
  assertSafeFixtureDatabase();
  const sql = postgres(databaseUrl, { connect_timeout: 2, idle_timeout: 1, max: 1 });
  try {
    await sql.begin(async (transaction) => {
      await transaction`
        delete from organizations
        where slug in (select 'personal-' || id from users where email = ${email})
      `;
      await transaction`
        delete from profiles where user_id in (select id from users where email = ${email})
      `;
      await transaction`delete from users where email = ${email}`;
    });
  } finally {
    await sql.end({ timeout: 1 });
  }
}

test.use({ storageState: { cookies: [], origins: [] } });
test.beforeAll(deleteAccount);
test.afterAll(deleteAccount);

test("a new account lands on home once after registering", async ({ page }) => {
  await page.goto(`/${locale}/login`, { waitUntil: "networkidle" });
  await dismissCookieBanner(page);

  const emailInput = page.getByPlaceholder("Enter your email...");
  await emailInput.fill(email);
  await expect(emailInput).toHaveValue(email);

  const previousOtp = await readLatestSignInOtp(databaseUrl, email).catch(() => null);
  await page.getByRole("button", { name: "Continue with Email" }).click();
  const otp = await waitForFreshOtp(databaseUrl, email, previousOtp);

  // While the account is unregistered, the navbar's platform link prefetches a redirect back to
  // registration. Registering has to drop it, or home and registration redirect to each other.
  const platformPrefetch = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/${locale}/platform` &&
      "next-router-prefetch" in response.request().headers(),
  );
  await page.locator('input[autocomplete="one-time-code"]').fill(otp);
  await page.waitForURL(`**/${locale}/register`);
  await platformPrefetch;

  await page.getByPlaceholder("Enter your first name").fill("Registration");
  await page.getByPlaceholder("Enter your last name").fill("Probe");
  await page.getByRole("checkbox", { name: "I accept the terms and conditions" }).click();

  const pathsAfterSubmit: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) pathsAfterSubmit.push(new URL(frame.url()).pathname);
  });
  await page.getByRole("button", { name: "Register", exact: true }).click();

  await page.waitForURL(`**/${locale}/platform`);

  // The prompt is modal, so the page behind it is hidden from role queries until it closes.
  const passkeyDismiss = page.getByRole("button", { name: "Not now" });
  const passkeyPromptAppeared = await passkeyDismiss
    .waitFor({ state: "visible", timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  if (passkeyPromptAppeared) await passkeyDismiss.click();
  expect(pathsAfterSubmit, "home redirected back to registration").not.toContain(
    `/${locale}/register`,
  );

  const joinOrganization = page.getByRole("link", { name: /Join an organization/ });
  await expect(joinOrganization).toBeVisible();
  await joinOrganization.click();
  await page.waitForURL(`**/${locale}/platform/organizations`);
});
