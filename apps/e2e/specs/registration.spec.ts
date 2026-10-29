import { count, eq, inArray } from "@repo/database";
import { organizations, profiles, users } from "@repo/database/schema";
import { readLatestSignInOtp } from "@repo/devkit/otp";

import { expect, test } from "../fixtures.js";
import {
  withFixtureDatabase,
  databaseUrl,
  dismissCookieBanner,
  locale,
  waitForFreshOtp,
} from "../helpers.js";

const email = "e2e-registration@openjii.local";
const repairEmail = "e2e-registration-repair@openjii.local";
const invalidEmail = "e2e-registration-invalid";
const fixtureEmails = [email, repairEmail, invalidEmail];

async function deleteAccount(): Promise<void> {
  await withFixtureDatabase((database) =>
    database.transaction(async (tx) => {
      const accounts = await tx
        .select({ id: users.id })
        .from(users)
        .where(inArray(users.email, fixtureEmails));
      if (accounts.length === 0) return;
      const ids = accounts.map((account) => account.id);
      await tx.delete(organizations).where(
        inArray(
          organizations.slug,
          ids.map((id) => `personal-${id}`),
        ),
      );
      await tx.delete(profiles).where(inArray(profiles.userId, ids));
      await tx.delete(users).where(inArray(users.id, ids));
    }),
  );
}

test.use({ storageState: { cookies: [], origins: [] } });
test.beforeAll(deleteAccount);
test.afterAll(deleteAccount);

test("a new account lands on home once after registering", async ({ page }) => {
  const forbiddenUpdates: string[] = [];
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname.endsWith("/auth/update-user") &&
      request.postData()?.includes('"registered"')
    ) {
      forbiddenUpdates.push(request.postData() ?? "");
    }
  });
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
  // Next dev does not automatically prefetch links; CI runs the production build.
  const platformPrefetch = process.env.CI
    ? page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === `/${locale}/platform` &&
          "next-router-prefetch" in response.request().headers(),
      )
    : Promise.resolve();
  const signInResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith("/auth/sign-in/email-otp"),
  );
  await page.locator('input[autocomplete="one-time-code"]').fill(otp);
  const backendOrigin = new URL((await signInResponse).url()).origin;
  await page.waitForURL(`**/${locale}/register`);
  await platformPrefetch;
  const before = await withFixtureDatabase(async (database) =>
    (
      await database
        .select({ registered: users.registered, profiles: count(profiles.userId) })
        .from(users)
        .leftJoin(profiles, eq(profiles.userId, users.id))
        .where(eq(users.email, email))
        .groupBy(users.id)
    ).at(0),
  );
  expect(before).toEqual({ registered: false, profiles: 0 });

  for (const fresh of [false, true]) {
    if (fresh) {
      await page.request.get(`${backendOrigin}/api/v1/auth/get-session?disableCookieCache=true`);
    }
    await page.goto(`/${locale}/platform`, { waitUntil: "networkidle" });
    await page.waitForURL(`**/${locale}/register**`);
    await expect(page.getByPlaceholder("Enter your first name")).toBeVisible();
  }
  await page.goto(`/${locale}/register`, { waitUntil: "networkidle" });

  await page.getByPlaceholder("Enter your first name").fill("Registration");
  await page.getByPlaceholder("Enter your last name").fill("Probe");
  await page.getByRole("checkbox", { name: "I accept the terms and conditions" }).click();

  const pathsAfterSubmit: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) pathsAfterSubmit.push(new URL(frame.url()).pathname);
  });
  await page.getByRole("button", { name: "Register", exact: true }).click();

  await page.waitForURL(`**/${locale}/platform`);
  expect(forbiddenUpdates).toEqual([]);
  const saved = await withFixtureDatabase(async (database) =>
    (
      await database
        .select({
          registered: users.registered,
          firstName: profiles.firstName,
          lastName: profiles.lastName,
        })
        .from(users)
        .innerJoin(profiles, eq(profiles.userId, users.id))
        .where(eq(users.email, email))
    ).at(0),
  );
  expect(saved).toEqual({ registered: true, firstName: "Registration", lastName: "Probe" });

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

test("email-only repair re-saves the existing profile without a client registration write", async ({
  page,
}) => {
  await page.goto(`/${locale}/login`, { waitUntil: "networkidle" });
  await dismissCookieBanner(page);
  await page.getByPlaceholder("Enter your email...").fill(repairEmail);
  const previousOtp = await readLatestSignInOtp(databaseUrl, repairEmail).catch(() => null);
  await page.getByRole("button", { name: "Continue with Email" }).click();
  const otp = await waitForFreshOtp(databaseUrl, repairEmail, previousOtp);
  const signInResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith("/auth/sign-in/email-otp"),
  );
  await page.locator('input[autocomplete="one-time-code"]').fill(otp);
  const backendOrigin = new URL((await signInResponse).url()).origin;
  await page.waitForURL(`**/${locale}/register`);

  await withFixtureDatabase(async (database) => {
    const avatar = new URL("/favicon.ico", page.url()).toString();
    const user = (
      await database.select({ id: users.id }).from(users).where(eq(users.email, repairEmail))
    ).at(0);
    if (!user) throw new Error("Repair fixture account missing");
    await database.insert(profiles).values({
      userId: user.id,
      firstName: "Legacy",
      lastName: "Researcher",
      bio: "Keep this bio",
      activated: true,
      avatarUrl: avatar,
    });
    await database
      .update(users)
      .set({ email: invalidEmail, emailVerified: true, registered: true })
      .where(eq(users.id, user.id));
    await page.request.get(`${backendOrigin}/api/v1/auth/get-session?disableCookieCache=true`);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByPlaceholder("Enter your first name")).toHaveCount(0);
    const writes: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname.endsWith("/auth/update-user"))
        writes.push(request.postData() ?? "");
    });
    const previousRepairOtp = await readLatestSignInOtp(databaseUrl, repairEmail).catch(() => null);
    await page.getByPlaceholder("Enter your email address").fill(repairEmail);
    await page.getByRole("button", { name: /Continue.*Email/i }).click();
    const repairOtp = await waitForFreshOtp(databaseUrl, repairEmail, previousRepairOtp);
    await page.locator('input[autocomplete="one-time-code"]').fill(repairOtp);
    await page.waitForURL(`**/${locale}/platform`);
    expect(writes).toEqual([]);
    const profile = (
      await database
        .select({
          email: users.email,
          registered: users.registered,
          firstName: profiles.firstName,
          lastName: profiles.lastName,
          bio: profiles.bio,
          activated: profiles.activated,
          avatarUrl: profiles.avatarUrl,
        })
        .from(users)
        .innerJoin(profiles, eq(profiles.userId, users.id))
        .where(eq(users.id, user.id))
    ).at(0);
    expect(profile).toEqual({
      email: repairEmail,
      registered: true,
      firstName: "Legacy",
      lastName: "Researcher",
      bio: "Keep this bio",
      activated: true,
      avatarUrl: avatar,
    });
  });
});
