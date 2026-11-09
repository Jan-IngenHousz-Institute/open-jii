import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import postgres from "postgres";

import { readLatestSignInOtp } from "@repo/devkit/otp";

export const locale = process.env.E2E_LOCALE ?? "en-US";
export const seedEmail = process.env.E2E_EMAIL ?? "seed@openjii.local";
export const newcomerEmail = "newcomer@openjii.local";
export const databaseUrl =
  process.env.E2E_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5432/openjii_local";
// The backend's AUTH_SECRET, which the stored sign-in codes are encrypted with.
export const authSecret =
  process.env.E2E_AUTH_SECRET ??
  process.env.AUTH_SECRET ??
  "local-dev-secret-change-me-000000000000";

export function assertSafeFixtureDatabase(url = databaseUrl): void {
  const database = new URL(url);
  const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(database.hostname);
  const isLocalDatabase = decodeURIComponent(database.pathname.slice(1)) === "openjii_local";
  if ((isLoopback && isLocalDatabase) || process.env.E2E_ALLOW_UNSAFE_DATABASE === "1") return;
  throw new Error(
    `Refusing to mutate ${database.hostname}${database.pathname}. Set E2E_ALLOW_UNSAFE_DATABASE=1 to override.`,
  );
}

export async function dismissCookieBanner(page: Page): Promise<void> {
  const button = page.getByRole("button", { name: "Reject all" });
  if (await button.isVisible().catch(() => false)) await button.click();
}

/** Reopen the saved list URL through both a document reload and a fresh shared link. */
export async function expectSearchSurvivesReopen(
  page: Page,
  {
    search,
    term,
    matchingName,
    excludedName,
    rows = page,
  }: {
    search: Locator;
    term: string;
    matchingName: string;
    excludedName: string;
    rows?: Locator | Page;
  },
): Promise<void> {
  const sharedUrl = page.url();
  for (const reopen of ["reload", "shared link"]) {
    if (reopen === "reload") await page.reload();
    else {
      await page.goto("about:blank");
      await page.goto(sharedUrl);
    }

    await expect(search).toHaveValue(term);
    await expect(rows.getByRole("link", { name: matchingName, exact: true }).first()).toBeVisible();
    await expect(rows.getByRole("link", { name: excludedName, exact: true })).toHaveCount(0);
    await expect(page).toHaveURL(sharedUrl);
    expect(new URL(page.url()).searchParams.get("q")).toBe(term);
  }
}

export async function waitForFreshOtp(
  url: string,
  email: string,
  previousOtp: string | null,
  timeoutMs = 20_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  // A missing row is expected until the code is sent; a wrong AUTH_SECRET is not, so the timeout
  // carries the last error.
  let lastError: unknown;
  while (Date.now() < deadline) {
    const otp = await readLatestSignInOtp(url, email, authSecret).catch((error: unknown) => {
      lastError = error;
      return null;
    });
    if (otp && otp !== previousOtp) return otp;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No fresh sign-in OTP found for ${email} within ${timeoutMs}ms`, {
    cause: lastError,
  });
}

export interface SeedExperiment {
  id: string;
  name: string;
}

export async function findSeedExperiment(): Promise<SeedExperiment> {
  const sql = postgres(databaseUrl, { connect_timeout: 2, idle_timeout: 1, max: 1 });
  try {
    const rows = await sql<SeedExperiment[]>`
      select e.id, e.name
      from experiments e
      join users u on u.id = e.created_by
      where u.email = ${seedEmail}
        and e.status = 'active'
        and e.name like '[Seed]%'
      order by e.created_at
      limit 1
    `;
    const experiment = rows.at(0);
    if (!experiment) throw new Error(`No active [Seed] experiment found for ${seedEmail}`);
    return experiment;
  } finally {
    await sql.end({ timeout: 1 });
  }
}
