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
const repairEmail = "e2e-registration-repair@openjii.local";
const invalidEmail = "e2e-registration-invalid";
const fixtureEmails = [email, repairEmail, invalidEmail];

async function deleteAccount(): Promise<void> {
  assertSafeFixtureDatabase();
  const sql = postgres(databaseUrl, { connect_timeout: 2, idle_timeout: 1, max: 1 });
  try {
    await sql.begin(async (transaction) => {
      await transaction`
        delete from organizations
        where slug in (select 'personal-' || id from users where email in ${transaction(fixtureEmails)})
      `;
      await transaction`
        delete from profiles where user_id in (select id from users where email in ${transaction(fixtureEmails)})
      `;
      await transaction`delete from users where email in ${transaction(fixtureEmails)}`;
    });
  } finally {
    await sql.end({ timeout: 1 });
  }
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
  const sql = postgres(databaseUrl, { connect_timeout: 2, idle_timeout: 1, max: 1 });
  try {
    const [before] =
      await sql`select u.registered, count(p.user_id)::int as profiles from users u left join profiles p on p.user_id = u.id where u.email = ${email} group by u.id`;
    expect(before).toEqual({ registered: false, profiles: 0 });
  } finally {
    await sql.end({ timeout: 1 });
  }

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
  const savedSql = postgres(databaseUrl, { connect_timeout: 2, idle_timeout: 1, max: 1 });
  try {
    const [saved] =
      await savedSql`select u.registered, p.first_name, p.last_name from users u join profiles p on p.user_id = u.id where u.email = ${email}`;
    expect(saved).toEqual({ registered: true, first_name: "Registration", last_name: "Probe" });
  } finally {
    await savedSql.end({ timeout: 1 });
  }

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

  const sql = postgres(databaseUrl, { connect_timeout: 2, idle_timeout: 1, max: 1 });
  try {
    const avatar = new URL("/favicon.ico", page.url()).toString();
    const [user] = await sql<{ id: string }[]>`select id from users where email = ${repairEmail}`;
    expect(user, "Repair fixture account missing").toBeDefined();
    await sql`insert into profiles (user_id, first_name, last_name, bio, activated, avatar_url) values (${user.id}, 'Legacy', 'Researcher', 'Keep this bio', true, ${avatar})`;
    await sql`update users set email = ${invalidEmail}, email_verified = true, registered = true where id = ${user.id}`;
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
    const [profile] =
      await sql`select u.email, u.registered, p.first_name, p.last_name, p.bio, p.activated, p.avatar_url from users u join profiles p on p.user_id = u.id where u.id = ${user.id}`;
    expect(profile).toEqual({
      email: repairEmail,
      registered: true,
      first_name: "Legacy",
      last_name: "Researcher",
      bio: "Keep this bio",
      activated: true,
      avatar_url: avatar,
    });
  } finally {
    await sql.end({ timeout: 1 });
  }
});
