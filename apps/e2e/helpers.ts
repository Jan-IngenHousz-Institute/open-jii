import type { Page } from "@playwright/test";
import type * as DrizzlePostgres from "drizzle-orm/postgres-js" with { "resolution-mode": "require" };
import { createRequire } from "node:module";
import postgres from "postgres";

import { and, eq } from "@repo/database";
import { organizations } from "@repo/database/schema";
import { readLatestSignInOtp } from "@repo/devkit/otp";

// The shared schema uses Drizzle's CommonJS types; load the same driver entry.
const drizzlePostgres = createRequire(import.meta.url)(
  "drizzle-orm/postgres-js",
) as typeof DrizzlePostgres;

export const locale = process.env.E2E_LOCALE ?? "en-US";
export const seedEmail = process.env.E2E_EMAIL ?? "seed@openjii.local";
export const newcomerEmail = "newcomer@openjii.local";
export const databaseUrl =
  process.env.E2E_DATABASE_URL ??
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:5432/openjii_local";

export function assertSafeFixtureDatabase(url = databaseUrl): void {
  const database = new URL(url);
  const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(database.hostname);
  const isLocalDatabase = decodeURIComponent(database.pathname.slice(1)) === "openjii_local";
  if ((isLoopback && isLocalDatabase) || process.env.E2E_ALLOW_UNSAFE_DATABASE === "1") return;
  throw new Error(
    `Refusing to mutate ${database.hostname}${database.pathname}. Set E2E_ALLOW_UNSAFE_DATABASE=1 to override.`,
  );
}

export async function withFixtureDatabase<T>(
  run: (database: DrizzlePostgres.PostgresJsDatabase) => Promise<T>,
): Promise<T> {
  assertSafeFixtureDatabase();
  const sql = postgres(databaseUrl, { connect_timeout: 2, idle_timeout: 1, max: 1 });
  try {
    return await run(drizzlePostgres.drizzle(sql));
  } finally {
    await sql.end({ timeout: 1 });
  }
}

export async function deleteFixtureOrganization(slug: string, name: string): Promise<void> {
  await withFixtureDatabase(async (database) => {
    await database
      .delete(organizations)
      .where(and(eq(organizations.slug, slug), eq(organizations.name, name)));
  });
}

export async function dismissCookieBanner(page: Page): Promise<void> {
  const button = page.getByRole("button", { name: "Reject all" });
  if (await button.isVisible().catch(() => false)) await button.click();
}

export async function waitForFreshOtp(
  url: string,
  email: string,
  previousOtp: string | null,
  timeoutMs = 20_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const otp = await readLatestSignInOtp(url, email).catch(() => null);
    if (otp && otp !== previousOtp) return otp;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No fresh sign-in OTP found for ${email} within ${timeoutMs}ms`);
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
